'use babel'

/* @flow */

import DebuggerMi2 from './debugger-mi2'
import type { EventDefs } from 'debugger'

module.exports = {
  instance: null,
  BreakpointEvent: null,
  SessionEvent: null,

  activate(): void {
    this.instance = new DebuggerMi2()
  },

  consumeEventDefs(eventDefs: EventDefs): void {
    this.BreakpointEvent = eventDefs.BreakpointEvent
    this.SessionEvent    = eventDefs.SessionEvent
  },

  provideDebugger(): DebuggerMi2 {
    return this.instance
  }
}
