
export interface Order {
    direction: "long" | "short";
    entry: number;
    sl: number;
    tp: number;
}

