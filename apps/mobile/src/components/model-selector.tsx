import React, { useState } from "react";
import { DropdownMenu, DropdownOption } from "./ui/dropdown-menu";

const MODEL_OPTIONS: DropdownOption[] = [
  { label: "GPT-4o", value: "gpt-4o" },
  { label: "Claude 3.5 Sonnet", value: "claude-3-5" },
  { label: "Gemini 1.5 Pro", value: "gemini-1-5" },
];

export function ModelSelector() {
  const [selected, setSelected] = useState(MODEL_OPTIONS[0]);

  return (
    <DropdownMenu
      label={selected.label}
      icon={selected.icon}
      options={MODEL_OPTIONS}
      onSelect={setSelected}
      direction="up"
      style={{
        backgroundColor: "transparent",
        paddingHorizontal: 8,
        minWidth: "auto",
      }}
      labelStyle={{
        fontSize: 14,
        fontWeight: "600",
      }}
    />
  );
}
