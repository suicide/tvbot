import logger from "./logging";
import {InverseClient} from "bybit-api";
import {Order} from "./order";

const apiKey = process.env.API_KEY || "";
const apiSecret = process.env.API_SECRET || "";
const useLive = process.env.USE_LIVE === "true" || false;

const defaultLeverage = Number.parseInt(process.env.LEVERAGE || "1");
const defaultOrderSize = Number.parseFloat(process.env.ORDER_SIZE || "0.95");

const client = new InverseClient(apiKey, apiSecret, useLive);

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

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}


async function getResult(res: Promise<any>): Promise<any> {
    const r = await res;
    if (r.ret_code !== 0) {
        logger.error("Result returned failure: %s", r);
        throw new Error(r.ret_msg);
    }
    return r.result;
}


class BybitHandler {

    private symbols: Record<string, SymbolProps> = {};

    private leverage = defaultLeverage;
    private orderSize = defaultOrderSize;

    constructor() {
        logger.info("Using Livenet: %s, API_KEY: %s, API_SECRET: %s",
                    useLive, apiKey.slice(0,3), apiSecret.slice(0,3));
    }

    async initSymbols() {
        const symbolsCall = await getResult(client.getSymbols());

        const symbols = symbolsCall as Array<any>;
        for (const sym of symbols) {
            this.symbols[sym.name] = {
                name: sym.name,
                baseCurrency: sym.base_currency,
                scale: sym.price_scale,
                tickSize: sym.price_filter.tick_size
            }
        }

        logger.debug("initialized symbols %j", this.symbols);
    }

    async getApiKey() {
        const apiCall = await getResult(client.getApiKeyInfo());

        return apiCall[0]?.api_key;
    }

    async setLeverage(symbol: string, leverage: number) {
        logger.debug(`Setting leverage to %d`, leverage);
        const res = await client
            .setUserLeverage({symbol: symbol, leverage: leverage});

        return res.result == leverage;
    }


    async openPosition(symbol: string, order: Order) {
        logger.info("Trying to open position on %s: %j", symbol, order);

        const sym = this.symbols[symbol];
        if (!sym) {
            logger.error("symbol not found on exchange %s", symbol);
            return false;
        }

        const hasPosition = await this.hasExistingPosition(symbol);
        if (hasPosition) {
            logger.error("open position found, skipping");
            return false;
        }
        const hasOrders = await this.hasOpenOrder(symbol);
        if (hasOrders) {
            logger.warn("open order found, trying to close");
            const closedAll = await this.cancelAllOpenOrders(symbol);
            if (closedAll) {
                // TODO
                const delayMs = 20000;
                logger.info("delay %d ms before retrying api", delayMs);
                await delay(delayMs);
                const retryOrders = await this.hasOpenOrder(symbol);
                if (retryOrders) {
                    logger.error("There are still open orders, aborting");
                    return false;
                }
            } else {
                logger.error("Unable to close open orders, aborting");
                return false;
            }
        }

        const balance = await this.getBalance(sym.baseCurrency);

        if (!balance) {
            logger.error("Unable to get balance: %s", balance);
            return false;
        }

        await this.setLeverage(symbol, this.leverage);

        const qty =
            Math.floor(balance * order.entry * this.orderSize * this.leverage);
        logger.debug("settng quantity to %d", qty);

        const direction = order.direction === "long" ?
            "Buy" :
                order.direction === "short" ?
                "Sell" : "";
        const entry = round(order.entry, sym.tickSize);
        const tp = round(order.tp, sym.tickSize);
        const sl = round(order.sl, sym.tickSize);

        logger.info(`Creating new %s order at %d with tp: %d and sl: %d, size: %d`,
                    direction, entry, tp, sl, qty);

        const result = await getResult(client.placeActiveOrder({
            side: direction,
            symbol: symbol,
            order_type: "Limit",
            price: entry,
            qty: qty,
            time_in_force: "GoodTillCancel",
            take_profit: tp,
            stop_loss: sl
        }));

        logger.debug("result %j", result);
        const success = result?.order_status === "Created";
        logger.info("new order placed: %s", success);
        return success;
    }

    async hasExistingPosition(symbol: string) {
        const position = await getResult(client.getPosition({symbol: symbol}));
        // logger.debug("positions", positionCall);
        return position.size > 0;
    }

    async hasOpenOrder(symbol: string) {

        const ordersResult = await getResult(
            client.getActiveOrderList({symbol: symbol, order_status: "New"}));
        logger.debug("ordersResult: %j", ordersResult);

        const orders = ordersResult.data as Array<any>;
        logger.debug("orders: %j", orders);

        return !!orders && !!orders.length;
    }

    async getBalance(symbol: string): Promise<number> {
        const balance = await getResult(client.getWalletBalance({coin: symbol}));
        logger.debug("balance %j", balance);

        const b = balance[symbol]?.available_balance;
        logger.info("Available balance %d", b);
        return b;
    }

    async cancelAllOpenOrders(symbol: string): Promise<boolean> {
        const res = await getResult(client.cancelAllActiveOrders({symbol: symbol}));

        return !!res;
    }
}

export const bbClient = new BybitHandler();

bbClient.initSymbols();
const key = bbClient.getApiKey();

if (!key) {
    logger.error("No API key info returned: %s", key);
    throw new Error("No API key info returned");
}
