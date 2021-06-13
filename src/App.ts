import express, { Application, Request, Response} from 'express';
import {bbClient} from "./bybit";
import { Order } from './order';

const app: Application = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get(
    "*",
    async (req: Request, res: Response): Promise<Response> => {
        console.log(req);
        return res.status(200).send({
            message: "Hello World!",
        });
    }
);
app.post(
    "/bybit/:symbol",
    async (req: Request, res: Response): Promise<Response> => {
        console.log(req.body);
        const result = await bbClient.openPosition(req.params.symbol, req.body);
        return res.status(200).send({
            success: result
        });
    }
);

try {
    app.listen(port, (): void => {
        console.log(`Connected successfully on port ${port}`);
    });
} catch (error) {
    console.error(`Error occured: ${error.message}`);
}
