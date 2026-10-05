import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface CountryComboboxProps {
  id?: string;
  value: string;
  onChange: (code: string) => void;
}

export function CountryCombobox({ id, value, onChange }: CountryComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {value ? `${countryName(value)} (${value})` : <span className="text-muted-foreground">Select a country…</span>}
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country or code…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            {COUNTRIES.map((country) => (
              <CommandItem
                key={country.code}
                value={`${country.name} ${country.code}`}
                onSelect={() => {
                  onChange(country.code);
                  setOpen(false);
                }}
              >
                <Check className={cn("size-4", value === country.code ? "opacity-100" : "opacity-0")} />
                {country.name}
                <span className="ml-auto text-xs text-muted-foreground">{country.code}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
