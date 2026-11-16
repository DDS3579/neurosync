import { LibraryWorkspace } from "@/features/library/components/LibraryWorkspace";
import { LIBRARY_ENTRIES } from "@/data/library";

export default function LibraryPage() {
  return <LibraryWorkspace entries={LIBRARY_ENTRIES} />;
}
