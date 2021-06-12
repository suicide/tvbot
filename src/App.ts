import express, { Application, Request, Response} from 'express';

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
    "*",
    async (req: Request, res: Response): Promise<Response> => {
        console.log(req.body);
        return res.status(200).send({
            message: "Hello World!",
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
