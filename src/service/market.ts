import { from } from "rxjs"
import { MarketAPI, MarketDetailMerged, MarketSymbols, BaseCurrency } from "../utils/const"
import { qGet } from "../utils/rest"

export interface MarketDetailMergedInfo {
    id: number,
    ts: number,
    close: number,
    open: number,
    high: number,
    low: number,
    amount: number,
    count: number,
    vol: number,
    ask: number[],
    bid: number[]
}

export function getMergedDetail(symbol: string): Promise<MarketDetailMergedInfo> {
    return qGet<MarketDetailMergedInfo>(MarketAPI + MarketDetailMerged, {
        symbol
    })
}

export function getAllSymbolInfo(): Promise<SymbolInfo[]> {
    return qGet<SymbolInfo[]>(MarketAPI + MarketSymbols, {})
}

export interface SymbolInfo {
    symbol: string,
    quoteCurrency: string
    baseCurrency: string
    pricePrecision?: number
    amountPrecision?: number,
    state?: string,
    valuePrecision?: number,
    minOrderAmt?: number,
    maxOrderAmt?: number,
    minOrderValue?: number
}

export function getSymbolInfo(symbol: string): SymbolInfo | null {
    for (let base of BaseCurrency) {
        const index = symbol.indexOf(base)
        if (index < 0) {
            continue
        }

        if (index + base.length === symbol.length) {
            return {
                symbol: symbol,
                quoteCurrency: base,
                baseCurrency: symbol.substring(0, index)
            }
        }
    }

    return null
}
