import { File } from 'sig/1.7.4/File'
import { BufferedProcess } from 'sig/1.7.4/BufferedProcess'
import { TextEditorMarker } from 'sig/1.7.4/TextEditorMarker'
import { CompositeDisposable, Disposable, Emitter } from 'event-kit'

declare module atom {

  declare var exports: {
    File: File,
    CompositeDisposable: CompositeDisposable,
    Disposable: Disposable,
    Emitter: Emitter,
    TextEditorMarker: TextEditorMarker,
    BufferedProcess: typeof BufferedProcess
  };
}
