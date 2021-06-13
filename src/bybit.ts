import {InverseClient} from "bybit-api";
import {Order} from "./order";

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
const client = new InverseClient(apiKey, apiSecret);

interface SymbolProps {
    name: string;
    baseCurrency: string;
    scale: number;
    tickSize: number;
}

function round(value: number, step: number) {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
}

class BybitHandler {

    private symbols: Record<string, SymbolProps> = {};

    private leverage = 1;
    private orderSize = 0.95;

    async initSymbols() {
        const symbolsCall = await client.getSymbols();

        const symbols = symbolsCall.result as Array<any>;
        for (const sym of symbols) {
            this.symbols[sym.name] = {
                name: sym.name,
                baseCurrency: sym.base_currency,
                scale: sym.price_scale,
                tickSize: sym.price_filter.tick_size
            }
        }

        console.log("initialized symbols", this.symbols);
    }

    async setLeverage(symbol: string, leverage: number) {
        // console.debug(`Setting leverage to`, leverage);
        const res = await client
            .setUserLeverage({symbol: symbol, leverage: leverage});

        return res.result == leverage;
    }


    async openPosition(symbol: string, order: Order) {
        const sym = this.symbols[symbol];
        if (!sym) {
            console.error("symbol not found on exchange", symbol);
            return false;
        }

        const hasPosition = await this.hasExistingPosition(symbol);
        if (hasPosition) {
            // TODO close position
            console.error("open position found");
            return false;
        }
        const hasOrders = await this.hasOpenOrder(symbol);
        if (hasOrders) {
            // TODO close position
            console.error("open order found");
            return false;
        }

        const balance = await this.getBalance(sym.baseCurrency);

        await this.setLeverage(symbol, this.leverage);

        const qty = Math.floor(balance * order.entry * this.orderSize * this.leverage);
        console.info("settng quantity to", qty);

        const direction = order.direction === "long" ? "Buy" : "Sell";
        const entry = round(order.entry, sym.tickSize);
        const tp = round(order.tp, sym.tickSize);
        const sl = round(order.sl, sym.tickSize);

        console.info(`Creating new ${direction} order at ${entry} with tp: ${tp} and sl: ${sl}, size: ${qty}`);

        const result = await client.placeActiveOrder({
            side: direction,
            symbol: symbol,
            order_type: "Limit",
            price: entry,
            qty: qty,
            time_in_force: "GoodTillCancel",
            take_profit: tp,
            stop_loss: sl
        });

        console.debug("result", result);
        const success = result.result.order_status == "Created";
        console.info("new order placed", success);
        return success;
    }

    async hasExistingPosition(symbol: string) {
        const positionCall = await client.getPosition({symbol: symbol})
        // console.debug("positions", positionCall);
        const position = positionCall.result;
        return position.size > 0;
    }

    async hasOpenOrder(symbol: string) {

        const ordersResult = await client.getActiveOrderList({symbol: symbol, order_status: "New"});
        // console.debug("ordersResult", ordersResult);

        const orders = ordersResult.result.data as Array<any>;
        console.log("orders", orders);

        return !!orders.length;
    }

    async getBalance(symbol: string): Promise<number> {
        const balance = await client.getWalletBalance({coin: symbol});
        // console.log("balance", balance);

        const b = balance.result[symbol].available_balance;
        console.info("Available balance", b);
        return b;
    }
}

export const bbClient = new BybitHandler();

bbClient.initSymbols();
