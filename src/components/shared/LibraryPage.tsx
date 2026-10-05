import { useMemo, useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusIcon } from "@/components/icons/plus";
import { PageHeader } from "@/components/layout/PageHeader";
import { ROW_ENTER, staggerStyle } from "@/lib/motion";
import { filterBySearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { AnimatedButton } from "./AnimatedButton";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { QueryState } from "./QueryState";
import { RowActions } from "./RowActions";
import { SearchInput } from "./SearchInput";

export interface LibraryColumn<T> {
  header: string;
  cell: (item: T) => ReactNode;
  className?: string;
}

interface LibraryPageProps<T extends { id: number }> {
  title: string;
  description: string;
  /** Singular, lower case: "athlete" → "Add athlete", "No athletes yet". */
  noun: string;
  emptyIcon: LucideIcon;
  emptyDescription: string;
  query: UseQueryResult<T[]>;
  columns: LibraryColumn<T>[];
  searchPlaceholder: string;
  searchFields: (item: T) => string[];
  /** Short user-facing name of an item, for the delete confirmation. */
  itemName: (item: T) => string;
  deleteNote?: string;
  onDelete: (item: T) => void;
  /** The add / edit dialog; `item` is null when adding. */
  renderForm: (props: { item: T | null; open: boolean; onOpenChange: (open: boolean) => void }) => ReactNode;
}

/** A searchable list of library records (athletes, exercises, categories) with add / edit / delete. */
export function LibraryPage<T extends { id: number }>(props: LibraryPageProps<T>) {
  const { title, description, noun, emptyIcon, emptyDescription, query, columns, searchPlaceholder, searchFields } = props;
  const [search, setSearch] = useState("");
  /** undefined = closed, null = adding a new record. */
  const [editing, setEditing] = useState<T | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<T | null>(null);

  const filtered = useMemo(() => filterBySearch(query.data ?? [], search, searchFields), [query.data, search, searchFields]);

  const addButton = (
    <AnimatedButton icon={PlusIcon} onClick={() => setEditing(null)}>
      Add {noun}
    </AnimatedButton>
  );

  return (
    <>
      <PageHeader title={title} description={description} actions={addButton} />

      <QueryState query={query}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState icon={emptyIcon} title={`No ${noun}s yet`} description={emptyDescription} action={addButton} />
          ) : (
            <div className="grid gap-4">
              <SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} />
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No {noun} matches "{search}".</p>
              ) : (
                <div className="overflow-hidden surface">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((column, index) => (
                          <TableHead key={column.header} className={cn(index === 0 && "pl-4", column.className)}>
                            {column.header}
                          </TableHead>
                        ))}
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((item, rowIndex) => (
                        <TableRow key={item.id} className={ROW_ENTER} style={staggerStyle(rowIndex)}>
                          {columns.map((column, index) => (
                            <TableCell key={column.header} className={cn(index === 0 && "pl-4 font-medium", column.className)}>
                              {column.cell(item)}
                            </TableCell>
                          ))}
                          <TableCell className="pr-4">
                            <RowActions noun={noun} onEdit={() => setEditing(item)} onDelete={() => setDeleting(item)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {filtered.length} of {items.length} {noun}s
              </p>
            </div>
          )
        }
      </QueryState>

      {props.renderForm({ item: editing ?? null, open: editing !== undefined, onOpenChange: (open) => !open && setEditing(undefined) })}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${noun}?`}
        description={deleting ? `"${props.itemName(deleting)}" will be removed permanently.${props.deleteNote ? ` ${props.deleteNote}` : ""}` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && props.onDelete(deleting)}
      />
    </>
  );
}
