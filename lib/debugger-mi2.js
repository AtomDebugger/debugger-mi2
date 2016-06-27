'use babel'

/* @flow */

import type { DebuggerTarget } from './types'
import InterpreterMi2 from './interpreter-mi2'
import { BufferedProcess, Disposable, Emitter } from 'atom'

export default class DebuggerMi2 {
  interpreter: InterpreterMi2;
  emitter: Emitter;
  process: ?BufferedProcess;

  constructor() {
    this.interpreter = new InterpreterMi2()
    this.emitter     = this.interpreter.emitter
    this.process     = null

    this.onDidEndSession(() => {
      const debug       = this
      debug.process     = null
    })

    this.onStoppedExecution(data => {
      if (data.reason == 'exited-normally') {
        const debug = this
        debug.stop()
      }
    })
  }

  name(): string {
    return "debugger-mi2"
  }

  onIsRunning(callback: Function): Disposable {
    return this.emitter.on('is-running', callback)
  }

  onStoppedExecution(callback: Function): Disposable {
    return this.emitter.on('stopped-execution', callback)
  }

  onDidEndSession(callback: Function): Disposable {
    return this.emitter.on('did-end-session', callback)
  }

  onTriggeredBreakpoint(callback: Function): Disposable {
    return this.emitter.on('triggered-breakpoint', callback)
  }

  startLocally(target: DebuggerTarget): void {
    const command = atom.config.get('debugger-mi2.active-debugger')
    let   args    = atom.config.get('debugger-mi2.active-debugger-arguments') || []

    args = args.concat(target.filePath)

    if ('arguments' in target) {
      args = args.concat(target.arguments)
    }

    const options = {
      command: command,
      args: args,
      stdout: (data) => this.interpreter.interpret(data)
    }

    this.process = new BufferedProcess(options).process

    const stdin = this.process.stdin

    const breakAtMain = atom.config.get('debugger-mi2.break-at-main')

    if (breakAtMain) {
      stdin.write('-break-insert main\n')
    }

    stdin.write('-exec-run\n')
  }

  stop(): void {
    if (this.process) {
      this.process.stdin.write('-gdb-exit\n')
    }
  }

  resume(): void {
    if (this.process) {
      this.process.stdin.write('-exec-continue\n')
    }
  }

  pause(): void {
    if (this.process) {
      this.process.stdin.write('-exec-interrupt\n')
    }
  }

  stepInto(): void {
    if (this.process) {
      this.process.stdin.write('-exec-step\n')
    }
  }

  stepOver(): void {
    if (this.process) {
      this.process.stdin.write('-exec-next\n')
    }
  }
}
