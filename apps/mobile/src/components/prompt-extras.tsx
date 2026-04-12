import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { DropdownMenu, DropdownOption } from "./ui/dropdown-menu";
import { Spacing } from "@/constants/theme";
import {
  LaptopIcon,
  LaptopCloudIcon,
  ShieldIcon,
  BranchIcon,
} from "./icons/Icon";
import { useRuntimeOptionsStore } from "@/store/runtime-options";
import { useSessionStore } from "@/store/session";
import { relayService } from "@/services/relay";
import { getGitCwd, requestGitBranches } from "@/utils/git";
import {
  setThreadBranchSelection,
  setThreadPermissionSelection,
} from "@/store/runtime-options";

const LOCAL_OPTIONS: DropdownOption[] = [
  { label: "Local", value: "local" },
  { label: "Cloud", value: "cloud" },
];

const SECURITY_OPTIONS: DropdownOption[] = [
  { label: "Supervised", value: "on-request" },
  { label: "Full access", value: "full" },
];

const FALLBACK_BRANCH_OPTIONS: DropdownOption[] = [
  { label: "main", value: "main" },
  { label: "develop", value: "develop" },
];

type SelectorProps = {
  style?: ViewStyle;
};

interface SelectorWithCallbacksProps extends SelectorProps {
  onDropdownOpen?: () => void;
  onDropdownClose?: () => void;
}

export function LocalSelector({
  style,
  onDropdownOpen,
  onDropdownClose,
}: SelectorWithCallbacksProps) {
  const [selected, setSelected] = useState(LOCAL_OPTIONS[0]);

  const IconComponent =
    selected.value === "cloud" ? LaptopCloudIcon : LaptopIcon;

  return (
    <DropdownMenu
      label={selected.label}
      icon={<IconComponent size={14} color="#888" />}
      options={LOCAL_OPTIONS}
      onSelect={setSelected}
      selectedValue={selected.value}
      style={style}
      labelStyle={{
        fontSize: 14,
        fontWeight: "600",
      }}
      dismissKeyboardOnOpen={false}
      onDropdownOpen={onDropdownOpen}
      onDropdownClose={onDropdownClose}
    />
  );
}

export function SecuritySelector({
  style,
  onDropdownOpen,
  onDropdownClose,
}: SelectorWithCallbacksProps) {
  const runtimePermission = useRuntimeOptionsStore(
    (state) => state.options.permission,
  );
  const threadSelections = useRuntimeOptionsStore(
    (state) => state.threadSelections,
  );
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const [selected, setSelected] = useState(SECURITY_OPTIONS[0]);

  useEffect(() => {
    const threadPermission = activeSessionId
      ? threadSelections[activeSessionId]?.permission || null
      : null;
    const effectivePermission = threadPermission || runtimePermission;

    if (effectivePermission) {
      const matchingOption = SECURITY_OPTIONS.find(
        (opt) => opt.value === effectivePermission,
      );
      if (matchingOption) {
        setSelected(matchingOption);
      } else {
        setSelected({
          label:
            effectivePermission === "on-request" ? "Supervised" : "Full access",
          value: effectivePermission,
        });
      }
    }
  }, [runtimePermission, activeSessionId, threadSelections]);

  const handleSelect = useCallback(
    (option: DropdownOption) => {
      setSelected(option);
      void setThreadPermissionSelection(activeSessionId, option.value);
    },
    [activeSessionId],
  );

  return (
    <DropdownMenu
      label={selected.label}
      icon={<ShieldIcon size={14} color="#888" />}
      options={SECURITY_OPTIONS}
      onSelect={handleSelect}
      selectedValue={selected.value}
      style={style}
      labelStyle={{
        fontSize: 14,
        fontWeight: "600",
      }}
      dismissKeyboardOnOpen={false}
      onDropdownOpen={onDropdownOpen}
      onDropdownClose={onDropdownClose}
    />
  );
}

export function BranchSelector({
  style,
  onDropdownOpen,
  onDropdownClose,
}: SelectorWithCallbacksProps) {
  const [branchOptions, setBranchOptions] = useState<DropdownOption[]>(
    FALLBACK_BRANCH_OPTIONS,
  );
  const [isLoading, setIsLoading] = useState(false);
  const runtimeBranch = useRuntimeOptionsStore((state) => state.options.branch);
  const threadSelections = useRuntimeOptionsStore(
    (state) => state.threadSelections,
  );
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const [selected, setSelected] = useState(FALLBACK_BRANCH_OPTIONS[0]);

  const fetchBranches = useCallback(async () => {
    const cwd = getGitCwd(activeProject?.description);
    if (!cwd || !relayService.isSecureReady()) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestGitBranches(cwd);
      const branches = result?.branches || [];
      const current = result?.current || "";

      if (branches.length > 0) {
        const options: DropdownOption[] = branches.map((branch) => ({
          label: branch,
          value: branch,
        }));
        setBranchOptions(options);

        if (current) {
          const currentOption = options.find((opt) => opt.value === current);
          if (currentOption) {
            setSelected(currentOption);
          } else {
            setSelected({ label: current, value: current });
          }
        }
      }
    } catch (error) {
      console.warn("[mobile][BranchSelector] fetch branches failed", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeProject?.description]);

  useEffect(() => {
    const threadBranch = activeSessionId
      ? threadSelections[activeSessionId]?.branch || null
      : null;
    const effectiveBranch = threadBranch || runtimeBranch;

    if (effectiveBranch) {
      const matchingOption = branchOptions.find(
        (opt) => opt.value === effectiveBranch,
      );
      if (matchingOption) {
        setSelected(matchingOption);
      } else {
        setSelected({
          label: effectiveBranch,
          value: effectiveBranch,
        });
      }
    } else if (!selected.value && branchOptions.length > 0) {
      setSelected(branchOptions[0]);
    }
  }, [
    runtimeBranch,
    activeSessionId,
    threadSelections,
    branchOptions,
    selected.value,
  ]);

  useEffect(() => {
    if (activeProject?.description) {
      fetchBranches();
    }
  }, [activeProject?.description, fetchBranches]);

  const handleSelect = useCallback(
    (option: DropdownOption) => {
      setSelected(option);
      void setThreadBranchSelection(activeSessionId, option.value);
    },
    [activeSessionId],
  );

  const dynamicOptions =
    selected.value && !branchOptions.some((opt) => opt.value === selected.value)
      ? [...branchOptions, selected]
      : branchOptions;

  return (
    <DropdownMenu
      label={isLoading ? "Loading..." : selected.label}
      icon={<BranchIcon size={14} color="#888" />}
      options={dynamicOptions}
      onSelect={handleSelect}
      selectedValue={selected.value}
      style={style}
      labelStyle={{
        fontSize: 14,
        fontWeight: "600",
      }}
      dismissKeyboardOnOpen={false}
      onDropdownOpen={onDropdownOpen}
      onDropdownClose={onDropdownClose}
    />
  );
}

export function PromptExtras({
  onDropdownOpen,
  onDropdownClose,
}: {
  onDropdownOpen?: () => void;
  onDropdownClose?: () => void;
}) {
  return (
    <View style={styles.container}>
      <LocalSelector
        style={styles.sideItem}
        onDropdownOpen={onDropdownOpen}
        onDropdownClose={onDropdownClose}
      />
      <SecuritySelector
        style={styles.middleItem}
        onDropdownOpen={onDropdownOpen}
        onDropdownClose={onDropdownClose}
      />
      <BranchSelector
        style={styles.sideItem}
        onDropdownOpen={onDropdownOpen}
        onDropdownClose={onDropdownClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: 12,
    paddingHorizontal: Spacing.one,
  },
  sideItem: {
    flex: 0.85,
  },
  middleItem: {
    flex: 1.3,
  },
});
