import { BasePool } from "./base_pool"
import { Msg , MsgType} from "../data/obj"
import { Op } from "../data/spot"

interface Tick {
    op: Op,
    ts: number
}

export class SpotAccount extends BasePool {

    responseHeartbeat (data: Msg) {
        if(data.msgType != MsgType.Msg || data.data == null) {
                return
        }

        let tick: Tick = JSON.parse(data.data)
        
        if (tick && tick.op === Op.Ping) {
            this.send({
                op: Op.Pong,
                ts: tick.ts
            })
        }
    }
}