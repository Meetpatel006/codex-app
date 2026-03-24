import React, { useState } from "react";
import { DropdownMenu, DropdownOption } from "./ui/dropdown-menu";

const REASONING_OPTIONS: DropdownOption[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Extra High", value: "extra_high" },
];

export function ReasoningSelector() {
  const [selected, setSelected] = useState(REASONING_OPTIONS[0]);

  return (
    <DropdownMenu
      label={selected.label}
      icon={{
        ios: "brain",
        android: "psychology",
        web: "psychology",
      }}
      options={REASONING_OPTIONS}
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
