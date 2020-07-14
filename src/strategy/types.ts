import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Connection } from "typeorm";
import { ColumnMetadata } from "typeorm/metadata/ColumnMetadata";
import { Grid } from "./grid";
import { Auth } from "../service/auth";
import { Order } from "../service/order";
import { Account } from "../service/account";
import { PlainObj } from "../data/obj";

export enum StrategyType {
    Grid = 'grid'
}

export enum StrategyState {
    On = 1,
    Off = 2,
    Invalid = 3,
}

@Entity()
export class StrategyInfo {
    @PrimaryGeneratedColumn()
    id: number

    @Column('json')
    content: PlainObj

    @Column('varchar', { length: 20 })
    type: StrategyType

    @Column('int')
    state: StrategyState

    @CreateDateColumn()
    createTime: string

    @UpdateDateColumn()
    updateTime: string
}

export function createStrategy(info: StrategyInfo, conn: Connection, authService: Auth, orderService: Order, accountService: Account): Strategy | undefined {
    switch (info.type) {
        case StrategyType.Grid:
            return new Grid(info, conn, authService, orderService, accountService)
        default:
            return
    }
}

export interface Strategy {
    info: StrategyInfo

    run(): Promise<void>;
    getSymbols(): string[];
    cli(): Promise<void>
}

@Entity()
export class StrategyOrder {
    @PrimaryGeneratedColumn()
    id: number

    @Column('int')
    strategyId: number

    @Column('bigint', { unique: true })
    orderId: number

    @CreateDateColumn()
    createTime: string

    @UpdateDateColumn()
    updateTime: string
}