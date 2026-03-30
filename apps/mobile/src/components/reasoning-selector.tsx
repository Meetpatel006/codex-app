import React, { useEffect, useState } from "react";
import { DropdownMenu, DropdownOption } from "./ui/dropdown-menu";
import {
  setThreadThinkingSelection,
  useRuntimeOptionsStore,
} from "@/store/runtime-options";
import { useSessionStore } from "@/store/session";

const REASONING_OPTIONS: DropdownOption[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

export function ReasoningSelector() {
  const runtimeOptions = useRuntimeOptionsStore((state) => state.options);
  const modelOptions = useRuntimeOptionsStore((state) => state.modelOptions);
  const selectedModel = useRuntimeOptionsStore((state) => state.selectedModel);
  const selectedThinking = useRuntimeOptionsStore(
    (state) => state.selectedThinking,
  );
  const threadSelections = useRuntimeOptionsStore(
    (state) => state.threadSelections,
  );
  const setSelectedThinking = useRuntimeOptionsStore(
    (state) => state.setSelectedThinking,
  );
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const [selected, setSelected] = useState(REASONING_OPTIONS[0]);

  const activeModel = selectedModel || runtimeOptions.model;
  const selectedModelDetails = modelOptions.find(
    (option) => (option.model || option.id) === activeModel,
  );
  const mappedReasoningOptions: DropdownOption[] = selectedModelDetails
    ?.supportedReasoningEfforts?.length
    ? selectedModelDetails.supportedReasoningEfforts.map((effort) => ({
        label:
          effort.reasoningEffort === "xhigh"
            ? "Extra High"
            : effort.reasoningEffort.charAt(0).toUpperCase() +
              effort.reasoningEffort.slice(1),
        value: effort.reasoningEffort,
      }))
    : REASONING_OPTIONS;

  const threadSelectedThinking = activeSessionId
    ? threadSelections[activeSessionId]?.thinking || null
    : null;
  const activeThinking =
    threadSelectedThinking || selectedThinking || runtimeOptions.thinking;

  useEffect(() => {
    if (activeThinking) {
      const matchingOption = mappedReasoningOptions.find(
        (option) => option.value === activeThinking,
      );
      if (matchingOption) {
        setSelected(matchingOption);
      } else {
        const capitalizedLabel =
          activeThinking.charAt(0).toUpperCase() + activeThinking.slice(1);
        setSelected({
          label: capitalizedLabel,
          value: activeThinking,
        });
      }
    }
  }, [activeThinking, mappedReasoningOptions]);

  const dynamicOptions = selected.value
    ? mappedReasoningOptions.some((option) => option.value === selected.value)
      ? mappedReasoningOptions
      : [...mappedReasoningOptions, selected]
    : mappedReasoningOptions;

  function handleSelect(option: DropdownOption) {
    setSelected(option);
    void setSelectedThinking(option.value);
    void setThreadThinkingSelection(activeSessionId, option.value);
  }

  return (
    <DropdownMenu
      label={selected.label}
      icon={{
        ios: "brain",
        android: "psychology",
        web: "psychology",
      }}
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
