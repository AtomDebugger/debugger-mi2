'use babel'

/* @flow */
import type { ExecutionLine } from 'debugger'

export default class MessageAdapter {

  adaptSessionMessage(data: mixed): ?ExecutionLine {

    if (data.frame) {
      return {
        filePath:  data.frame.fullname,
        bufferRow: data.frame.line-1
      }
    }
  }
}
