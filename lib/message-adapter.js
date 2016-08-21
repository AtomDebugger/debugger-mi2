'use babel'

import type { StackFrame } from 'debugger'

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

  adaptStackFrameMessage(data: mixed): StackFrame {

    let frame = data.frame

    return {
      level:     frame.level,
      address:   frame.addr,
      function:  frame.func,
      filePath:  (!frame.fullname || frame.fullname === '??') ? undefined : frame.fullname,
      bufferRow: (frame.line < 0) ? undefined : frame.line-1
    }
  }

  adaptCallStackMessage(data: mixed): Array<StackFrame> {

    if (!data.stack) {
      throw Error('expected "stack" in message')
    }

    let result = []

    for (let i=0; i<data.stack.length; i++) {

      let frame = data.stack[i].frame

      result.push(this.adaptStackFrameMessage(data.stack[i]))
    }

    return result
  }
}
