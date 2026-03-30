import React, { useEffect, useState } from "react";
import { DropdownMenu, DropdownOption } from "./ui/dropdown-menu";
import {
  setThreadModelSelection,
  useRuntimeOptionsStore,
} from "@/store/runtime-options";
import { useSessionStore } from "@/store/session";

const FALLBACK_MODEL_OPTIONS: DropdownOption[] = [
  { label: "GPT-5.4", value: "gpt-5.4" },
  { label: "GPT-5.4-Mini", value: "gpt-5.4-mini" },
  { label: "gpt-5.3-codex", value: "gpt-5.3-codex" },
  { label: "gpt-5.2-codex", value: "gpt-5.2-codex" },
  { label: "gpt-5.2", value: "gpt-5.2" },
  { label: "gpt-5.1-codex-max", value: "gpt-5.1-codex-max" },
  { label: "gpt-5.1-codex-mini", value: "gpt-5.1-codex-mini" },
];

export function ModelSelector() {
  const runtimeOptions = useRuntimeOptionsStore((state) => state.options);
  const selectedModel = useRuntimeOptionsStore((state) => state.selectedModel);
  const threadSelections = useRuntimeOptionsStore(
    (state) => state.threadSelections,
  );
  const modelOptions = useRuntimeOptionsStore((state) => state.modelOptions);
  const setSelectedModel = useRuntimeOptionsStore(
    (state) => state.setSelectedModel,
  );
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const [selected, setSelected] = useState(FALLBACK_MODEL_OPTIONS[0]);

  const mappedModelOptions: DropdownOption[] =
    modelOptions.length > 0
      ? modelOptions
          .filter((option) => !option.hidden)
          .map((option) => ({
            label: option.displayName || option.model || option.id,
            value: option.model || option.id,
          }))
      : FALLBACK_MODEL_OPTIONS;

  const threadSelectedModel = activeSessionId
    ? threadSelections[activeSessionId]?.model || null
    : null;
  const activeModel =
    threadSelectedModel || selectedModel || runtimeOptions.model;

  useEffect(() => {
    if (activeModel) {
      const matchingOption = mappedModelOptions.find(
        (option) => option.value === activeModel,
      );
      if (matchingOption) {
        setSelected(matchingOption);
      } else {
        setSelected({
          label: activeModel,
          value: activeModel,
        });
      }
    }
  }, [activeModel, mappedModelOptions]);

  const dynamicOptions = selected.value
    ? mappedModelOptions.some((option) => option.value === selected.value)
      ? mappedModelOptions
      : [...mappedModelOptions, selected]
    : mappedModelOptions;

  function handleSelect(option: DropdownOption) {
    setSelected(option);
    void setSelectedModel(option.value);
    void setThreadModelSelection(activeSessionId, option.value);
  }

  return (
    <DropdownMenu
      label={selected.label}
      icon={selected.icon}
      options={dynamicOptions}
      onSelect={handleSelect}
      selectedValue={selected.value}
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
      dismissKeyboardOnOpen={false}
    />
  );
}
