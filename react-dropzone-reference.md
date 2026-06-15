# react-dropzone Reference (Next.js App Router + Tailwind + shadcn/ui)

Curated from the official docs (react-dropzone.js.org), the npm README, and the TypeScript typings (DropzoneOptions). Targets react-dropzone v14 with the headless `useDropzone` hook. Bring-your-own UI: no built-in styling is used; all visuals come from your own Tailwind/shadcn markup.

## Install

npm install react-dropzone

Next.js 15 note: Next 15 ships React 19, but react-dropzone declares a React 18 peer range. If npm errors on peer deps, install with:

npm install react-dropzone --legacy-peer-deps

The library works fine at runtime under React 19; this only silences the peer-dependency resolver.

## Core concept

`useDropzone(options)` is a headless hook. It does not render anything. It returns prop-getter functions you spread onto your own elements:

- `getRootProps()` -> spread onto the wrapper element (the drop area). Provides drag/drop and click-to-open behavior.
- `getInputProps()` -> spread onto a hidden `<input>`. Provides the native file picker.
- State flags (`isDragActive`, etc.) -> use to drive your own Tailwind classes / conditional content.

You own the DOM. You decide every class name. The hook only wires behavior.

## Minimal component (App Router, TypeScript)

Must be a Client Component. Add "use client" at the top because the hook uses browser APIs and event handlers.

"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";

export function Dropzone() {
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      // handle files here (e.g. upload to Supabase storage)
      console.log(acceptedFiles, fileRejections);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop the files here ...</p>
      ) : (
        <p>Drag and drop files here, or click to select</p>
      )}
    </div>
  );
}

## Styling with your own Tailwind / shadcn

Pass your className through the prop-getter, or put it on the element directly. Both work; passing through the getter is the documented pattern when you also want the getter to merge other props.

Use the state flags to switch classes. Example using the shadcn `cn()` helper and design tokens (border, muted, ring, etc.):

"use client";

import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

export function Dropzone() {
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({ accept: { "image/*": [] } });

  return (
    <div
      {...getRootProps({
        className: cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-background p-10 text-center text-sm text-muted-foreground transition-colors cursor-pointer outline-none",
          "hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
          isDragActive && "border-primary bg-accent/60 text-foreground",
          isDragReject && "border-destructive bg-destructive/10 text-destructive"
        ),
      })}
    >
      <input {...getInputProps()} />
      {isDragActive
        ? "Drop the files here"
        : "Drag and drop, or click to select"}
    </div>
  );
}

Notes:
- `getRootProps()` already sets `outline` styling concerns to you; add your own `outline-none` + `focus-visible:ring-*` for an accessible focus state.
- The root is keyboard-focusable and clickable by default. The hidden input is what actually opens the native picker.

## useDropzone options (from DropzoneOptions typings)

- accept?: Accept — object mapping MIME type -> array of extensions. v14 form. Examples below. (In old v11 docs this was a string; do NOT use the string form.)
- minSize?: number — minimum file size in bytes.
- maxSize?: number — maximum file size in bytes.
- maxFiles?: number — max number of files accepted. 0 or unset = unlimited.
- multiple?: boolean — allow multiple files (default true). Set false for single-file.
- disabled?: boolean — disable the whole dropzone.
- preventDropOnDocument?: boolean — prevent the browser opening a file dropped outside the zone (default true).
- noClick?: boolean — disable click-to-open (drag only).
- noKeyboard?: boolean — disable keyboard interaction (space/enter to open).
- noDrag?: boolean — disable drag-and-drop (click only).
- noDragEventsBubbling?: boolean — stop drag events bubbling to parents.
- onDrop?: (acceptedFiles, fileRejections, event) => void — fires on every drop, accepted or rejected.
- onDropAccepted?: (files, event) => void — only accepted files.
- onDropRejected?: (fileRejections, event) => void — only rejected files.
- onFileDialogOpen?: () => void
- onFileDialogCancel?: () => void
- onError?: (err: Error) => void
- validator?: (file) => FileError | FileError[] | null — custom per-file validation (see below).
- getFilesFromEvent?: (event) => Promise<Array<File | DataTransferItem>> — advanced; override how files are read from the event.
- useFsAccessApi?: boolean — use the browser File System Access API picker instead of a hidden input. Default behavior varies; set false for the traditional hidden-input flow (more predictable cross-browser, notably Safari). See caveat below.
- autoFocus?: boolean — focus the root on mount.

## useDropzone return values

- getRootProps(props?) — prop getter for the wrapper. You can pass your own props/className in; they merge.
- getInputProps(props?) — prop getter for the hidden input.
- isFocused — root is focused.
- isDragActive — a drag is currently over the zone.
- isDragAccept — the dragged items would be accepted (matches accept).
- isDragReject — the dragged items would be rejected.
- acceptedFiles: File[] — current accepted files.
- fileRejections: FileRejection[] — current rejected files, each `{ file, errors: FileError[] }`. (Old docs call this `rejectedFiles`; v14 uses `fileRejections`.)
- open() — programmatically open the file dialog (e.g. from a separate button). Pair with `noClick: true` if you only want a button to trigger it.
- rootRef, inputRef — refs to the underlying elements.

## accept syntax (v14)

Object keyed by MIME type; value is an array of file extensions (can be empty):

accept: {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
}

Wildcards are allowed:

accept: { "image/*": [] }

Gotcha: in v14 you cannot set different maxSize per file type via options alone — use the `validator` for per-type size rules.

## File size limits

Sizes are in bytes. Helpful constants:

const MB = 1024 * 1024;
maxSize: 5 * MB,   // 5 MB
minSize: 0,

## Showing previews (object URLs) and avoiding memory leaks

For image previews, attach `URL.createObjectURL(file)` and revoke it when done to avoid leaks:

"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

type Preview = File & { preview: string };

export function ImageDropzone() {
  const [files, setFiles] = useState<Preview[]>([]);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...accepted.map((file) =>
        Object.assign(file, { preview: URL.createObjectURL(file) })
      ),
    ]);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
  });

  // Revoke object URLs on unmount to free memory.
  useEffect(() => {
    return () => files.forEach((f) => URL.revokeObjectURL(f.preview));
  }, [files]);

  return (
    <div>
      <div {...getRootProps()}>
        <input {...getInputProps()} />
        <p>Drag and drop, or click to select</p>
      </div>
      <ul>
        {files.map((file) => (
          <li key={file.name}>
            <img src={file.preview} alt={file.name} />
          </li>
        ))}
      </ul>
    </div>
  );
}

If using next/image for previews, revoke the URL in the image's onLoad after it renders, or keep the useEffect cleanup above.

## Custom validation (validator)

Return null to accept, or a FileError (`{ code, message }`) / array of them to reject:

const validator = (file: File) => {
  if (file.name.length > 100) {
    return { code: "name-too-long", message: "Name must be under 100 chars" };
  }
  return null;
};

const { getRootProps, getInputProps } = useDropzone({ validator });

Each rejection then appears in `fileRejections` as `{ file, errors }`, so you can render messages from `errors[0].message`.

## Programmatic open (button instead of clickable area)

const { getRootProps, getInputProps, open } = useDropzone({ noClick: true, noKeyboard: true });

// then in your JSX:
// <div {...getRootProps()}><input {...getInputProps()} /></div>
// <button type="button" onClick={open}>Select files</button>

## useFsAccessApi caveat

When `useFsAccessApi: true`, the lib uses the native File System Access API picker and removing the `<input>` has no effect. That API is not supported in all browsers (e.g. Safari), and there have been reports of `open()` not working programmatically when it is false on some browsers. For broad, predictable behavior with a hidden input, set `useFsAccessApi: false` and always render `<input {...getInputProps()} />`.

## Next.js App Router checklist

- The component using useDropzone must be a Client Component ("use client").
- Do the actual upload (e.g. to Supabase storage) inside onDrop / onDropAccepted, or collect files in state and upload on submit via a server action.
- Files from the browser are standard File objects; pass them to your Supabase storage upload call.
- Revoke any object URLs you create for previews.

## Common gotchas summary

- Use the v14 object form of accept, not the old string form.
- It is fileRejections, not rejectedFiles, in v14.
- Always render the hidden input from getInputProps unless you deliberately use the FS Access API.
- The hook renders nothing and ships no styles — all UI/Tailwind is yours.
- On Next 15 / React 19, install with --legacy-peer-deps if peer resolution fails.
