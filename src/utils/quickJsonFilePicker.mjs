/**
 * Read a file from the native picker and reset the input immediately, so the
 * same file can be picked again on the next click. A cancelled picker returns
 * null; the caller must not open a modal in that case.
 */
export function consumeQuickJsonFile(event){
 const input=event?.currentTarget||event?.target;
 const file=input?.files?.[0]||null;
 if(input)input.value="";
 return file;
}
