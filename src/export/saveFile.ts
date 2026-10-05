import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

interface SaveFileOptions {
  defaultName: string;
  /** Shown in the dialog's file-type list, e.g. "PDF document". */
  typeName: string;
  extension: string;
  contents: Uint8Array;
}

/**
 * Asks where to save with the native "Save as" dialog, then writes the file.
 * The dialog grants write access to exactly the path picked. Resolves false if cancelled.
 */
export async function saveFile({ defaultName, typeName, extension, contents }: SaveFileOptions): Promise<boolean> {
  const path = await save({ defaultPath: `${defaultName}.${extension}`, filters: [{ name: typeName, extensions: [extension] }] });
  if (!path) return false;
  await writeFile(path, contents);
  return true;
}
