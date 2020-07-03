import { qGet } from "../utils/rest";
import { MarketAPI, MarketKline } from "../utils/const";

export enum Period {
    Min1 = '1min',
    Min5 = '5min',
    Min15 = '15min',
    Min30 = '30min',
    Min60 = '60min',
    Hour4 = '4hour',
    Day = '1day',
    Month = '1mon',
    Week = '1week',
    Year = '1year'
}

export interface KLineInfo {
    id: number,
    amount: number,
    count: number,
    open: number,
    close: number,
    low: number,
    high: number,
    vol: number
}

export class Kline {

    async getKlineInfo(symbol: string, period: Period, size: number): Promise<KLineInfo[]> {
        return qGet<KLineInfo[]>(MarketAPI + MarketKline, {}, 200)
    }
}