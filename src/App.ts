import logger from "./logging";
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
        logger.debug("some request");
        return res.status(200).send({
            message: "Hello World!",
        });
    }
);
app.post(
    "/bybit/:symbol",
    async (req: Request, res: Response): Promise<Response> => {

        try {
            const result = await bbClient.openPosition(req.params.symbol, req.body);
            if (!result) {
                logger.error("Failed to open position");
            }
            return res.status(result ? 200 : 400).send({
                success: result
            });
        } catch (error) {
            logger.error("Failed to open position %j", error);
            return res.status(500).send({
                success: false,
                err: error
            });
        }
    }
);

try {
    app.listen(port, (): void => {
        logger.info(`Connected successfully on port ${port}`);
    });
} catch (error) {
    logger.error(`Error occured: ${error.message}`);
}
