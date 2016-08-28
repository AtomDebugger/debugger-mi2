'use babel'

/* @flow */

import type { StackFrame } from 'debugger'

import type { ExecutionLine, Variable } from 'debugger'

export default class MessageAdapter {

  adaptSessionMessage(data: mixed): ?ExecutionLine {

    if (data.frame) {
      const frame = data.frame
      return {
        filePath:  (frame.fullname && frame.fullname !== '??') ? frame.fullname : undefined,
        bufferRow: (frame.line >= 0) ? frame.line-1 : undefined
      }
    }
  }

  adaptStackFrameMessage(data: mixed): StackFrame {

    if (!data.frame) { throw new Error('Expected "frame" in message') }

    let frame = data.frame

    return {
      level:     frame.level,
      address:   frame.addr,
      function:  frame.func,
      filePath:  (frame.fullname && frame.fullname !== '??') ? frame.fullname : undefined,
      bufferRow: (frame.line >= 0) ? frame.line-1 : undefined
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

  adaptVariableMessage(data: mixed): Variable {

    let variable = new Object()

    if (!data.name) { throw new Error('Expected "name" in message') }

    variable.id = data.name
    variable.name  = (data.exp) ? data.exp : variable.id

    if (data.value)    { variable.value = (data.value !== '??') ? data.value : null }
    if (data.type)     { variable.type  = data.type }
    if (data.numchild) { variable.has_children = (+data.numchild > 0)}

    return variable
  }

  adaptVariablesMessage(data: mixed): Array<Variable> {

    if (!data.variables) {
      throw new Error('expected "variables" in message')
    }

    const result = []

    for (let i=0; i<data.variables.length; i++) {
      result.push(this.adaptVariableMessage(data.variables[i]))
    }

    return result
  }

  adaptChildrenMessage(data: mixed): Array<Variable> {

    if (!data.children) { throw new Error('expected "children" in message') }

    const result = []

    for (let i=0; i<data.children.length; i++) {
      if (!data.children[i].child) {
        throw new Error('expected "child" in data.children[i]')
      }

      result.push(this.adaptVariableMessage(data.children[i].child))
    }

    return result
  }
}
