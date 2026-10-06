import { useState } from "react";
import { Plus, Tags, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusIcon } from "@/components/icons/plus";
import { PageHeader } from "@/components/layout/PageHeader";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryState } from "@/components/shared/QueryState";
import { RowActions } from "@/components/shared/RowActions";
import type { AgeGroup, AgeSubgroup, CategoryLevel, Federation } from "@/db/categoryLibrary";
import type { CompetitionKind } from "@/db/competitions";
import { COMPETITION_KIND_LABELS, describeCategoryRules, FEDERATION_LABELS, subgroupName } from "@/lib/labels";
import { ROW_ENTER, staggerStyle } from "@/lib/motion";
import { NameFormDialog } from "@/components/shared/NameFormDialog";
import { FederationPicker } from "./FederationPicker";
import { SubgroupFormDialog } from "./SubgroupFormDialog";
import { useCategoryLibrary, useCategoryLibraryMutations } from "./useCategoryLibrary";

type Editing =
  | { kind: "group"; group: AgeGroup | null }
  | { kind: "subgroup"; group: AgeGroup; subgroup: AgeSubgroup | null }
  | { kind: "level"; subgroup: AgeSubgroup; subgroupLabel: string; level: CategoryLevel | null };

interface PendingDelete {
  title: string;
  description: string;
  run: () => void;
}

const KEEP_COPIES = "Competitions that already use it keep their copy.";

export function CategoriesPage() {
  // One library per federation (IFBB, Romania) and challenge type (Fitness Challenge, Speed Fit).
  const [federation, setFederation] = useState<Federation>("ifbb");
  const [kind, setKind] = useState<CompetitionKind>("fitness_challenge");
  const libraryQuery = useCategoryLibrary({ federation, kind });
  const libraryName = `${FEDERATION_LABELS[federation]} ${COMPETITION_KIND_LABELS[kind]}`;
  const m = useCategoryLibraryMutations();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<PendingDelete | null>(null);
  const close = (open: boolean) => !open && setEditing(null);

  const addGroupButton = (
    <AnimatedButton icon={PlusIcon} onClick={() => setEditing({ kind: "group", group: null })}>
      Add age group
    </AnimatedButton>
  );

  return (
    <>
      <PageHeader
        title="Categories"
        description="Age groups, split into sub-groups by sex and age, each with its levels. Every level is ranked separately."
        actions={addGroupButton}
      />

      <FederationPicker value={federation} onChange={setFederation} className="mb-4" />

      <Tabs value={kind} onValueChange={(value) => setKind(value as CompetitionKind)} className="mb-4">
        <TabsList>
          {(Object.keys(COMPETITION_KIND_LABELS) as CompetitionKind[]).map((kind) => (
            <TabsTrigger key={kind} value={kind} className="px-3">
              {COMPETITION_KIND_LABELS[kind]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <QueryState query={libraryQuery}>
        {(groups) =>
          groups.length === 0 ? (
            <EmptyState
              icon={Tags}
              title={`No ${libraryName} age groups yet`}
              description={kind === "speed_fit" ? "Start with an age group such as Open, Junior or Masters, then add its sub-groups by sex (and age, if needed). Levels are optional." : "Start with an age group such as Junior, Senior or Masters, then add its sub-groups and levels."}
              action={addGroupButton}
            />
          ) : (
            <div className="grid gap-4">
              {groups.map((group, index) => (
                <section key={group.id} className={`surface ${ROW_ENTER}`} style={staggerStyle(index)}>
                  <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <h2 className="font-heading text-lg font-semibold">{group.name}</h2>
                    <div className="flex items-center gap-1">
                      <AnimatedButton icon={PlusIcon} variant="outline" size="sm" onClick={() => setEditing({ kind: "subgroup", group, subgroup: null })}>
                        Sub-group
                      </AnimatedButton>
                      <RowActions
                        noun="age group"
                        onEdit={() => setEditing({ kind: "group", group })}
                        onDelete={() =>
                          setDeleting({
                            title: "Delete age group?",
                            description: `"${group.name}" and all its sub-groups and levels will be removed from the library. ${KEEP_COPIES}`,
                            run: () => m.deleteGroup.mutate(group.id),
                          })
                        }
                      />
                    </div>
                  </header>

                  {group.subgroups.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No sub-groups yet. Add one per sex and age range, e.g. Men 14–23.</p>
                  ) : (
                    <ul className="divide-y">
                      {group.subgroups.map((subgroup) => {
                        const label = subgroupName(group.name, subgroup);
                        return (
                          <li key={subgroup.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <div className="w-56 shrink-0">
                              <p className="font-medium">{label}</p>
                              <p className="text-xs text-muted-foreground">{describeCategoryRules(subgroup)}</p>
                            </div>
                            <div className="flex flex-1 flex-wrap items-center gap-1.5">
                              {subgroup.levels.length === 0 && (
                                <span className="text-xs text-muted-foreground">No levels: added to competitions as one category.</span>
                              )}
                              {subgroup.levels.map((level) => (
                                <LevelChip
                                  key={level.id}
                                  level={level}
                                  onRename={() => setEditing({ kind: "level", subgroup, subgroupLabel: label, level })}
                                  onDelete={() =>
                                    setDeleting({
                                      title: "Delete level?",
                                      description: `"${level.name}" will be removed from ${label}. ${KEEP_COPIES}`,
                                      run: () => m.deleteLevel.mutate(level.id),
                                    })
                                  }
                                />
                              ))}
                              <Button variant="ghost" size="sm" onClick={() => setEditing({ kind: "level", subgroup, subgroupLabel: label, level: null })}>
                                <Plus /> Level
                              </Button>
                            </div>
                            <RowActions
                              noun="sub-group"
                              onEdit={() => setEditing({ kind: "subgroup", group, subgroup })}
                              onDelete={() =>
                                setDeleting({
                                  title: "Delete sub-group?",
                                  description: `"${label}" and its levels will be removed from the library. ${KEEP_COPIES}`,
                                  run: () => m.deleteSubgroup.mutate(subgroup.id),
                                })
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )
        }
      </QueryState>

      <NameFormDialog
        open={editing?.kind === "group"}
        onOpenChange={close}
        title={editing?.kind === "group" && editing.group ? "Rename age group" : `Add ${libraryName} age group`}
        label="Age group"
        placeholder="e.g. Junior, Senior, Masters"
        submitLabel={editing?.kind === "group" && editing.group ? "Save changes" : "Add age group"}
        initial={editing?.kind === "group" ? (editing.group?.name ?? "") : ""}
        saving={m.createGroup.isPending || m.renameGroup.isPending}
        onSave={(name) => {
          const group = editing?.kind === "group" ? editing.group : null;
          return group ? m.renameGroup.mutateAsync({ id: group.id, name }) : m.createGroup.mutateAsync({ federation, kind, name });
        }}
      />
      {editing?.kind === "subgroup" && (
        <SubgroupFormDialog ageGroup={editing.group} subgroup={editing.subgroup} open onOpenChange={close} />
      )}
      <NameFormDialog
        open={editing?.kind === "level"}
        onOpenChange={close}
        title={editing?.kind === "level" ? `${editing.level ? "Rename level of" : "Add level to"} ${editing.subgroupLabel}` : ""}
        label="Level"
        placeholder="e.g. Bronze, Silver, Gold"
        submitLabel={editing?.kind === "level" && editing.level ? "Save changes" : "Add level"}
        initial={editing?.kind === "level" ? (editing.level?.name ?? "") : ""}
        saving={m.createLevel.isPending || m.renameLevel.isPending}
        onSave={(name) => {
          if (editing?.kind !== "level") return Promise.resolve();
          return editing.level
            ? m.renameLevel.mutateAsync({ id: editing.level.id, name })
            : m.createLevel.mutateAsync({ subgroupId: editing.subgroup.id, name });
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting?.title ?? ""}
        description={deleting?.description ?? ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting?.run()}
      />
    </>
  );
}

function LevelChip({ level, onRename, onDelete }: { level: CategoryLevel; onRename: () => void; onDelete: () => void }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gold/60 bg-gold/10 text-sm">
      <button type="button" className="py-0.5 pr-1.5 pl-3 font-medium hover:underline" aria-label={`Rename level ${level.name}`} onClick={onRename}>
        {level.name}
      </button>
      <button type="button" className="py-1 pr-2 text-muted-foreground hover:text-destructive" aria-label={`Delete level ${level.name}`} onClick={onDelete}>
        <X className="size-3.5" />
      </button>
    </span>
  );
}
