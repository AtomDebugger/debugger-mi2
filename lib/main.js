'use babel'

/* @flow */

import DebuggerMi2 from './debugger-mi2'

module.exports = {
  instance: DebuggerMi2,

  activate(): void {
    this.instance = new DebuggerMi2()
  },

  provideDebugger(): DebuggerMi2 {
    return this.instance
  }
}
