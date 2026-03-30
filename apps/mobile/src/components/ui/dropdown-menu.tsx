import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  Keyboard,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";

export interface DropdownOption {
  label: string;
  value: string;
  icon?: { ios: string; android: string; web: string } | React.ReactNode;
}

export interface DropdownMenuProps {
  label: string;
  icon?: { ios: string; android: string; web: string } | React.ReactNode;
  options?: DropdownOption[];
  onSelect?: (option: DropdownOption) => void;
  selectedValue?: string;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  direction?: "up" | "down" | "auto";
  dismissKeyboardOnOpen?: boolean;
}

export function DropdownMenu({
  label,
  icon,
  options = [],
  onSelect,
  selectedValue,
  style,
  labelStyle,
  direction = "auto",
  dismissKeyboardOnOpen = true,
}: DropdownMenuProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [layout, setLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<View>(null);
  const theme = useTheme();

  const handlePress = () => {
    if (dismissKeyboardOnOpen) {
      Keyboard.dismiss();
    }
    containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setLayout({ x: pageX, y: pageY, width, height });
      setIsVisible(true);
    });
  };

  const handleSelect = (option: DropdownOption) => {
    onSelect?.(option);
    setIsVisible(false);
  };

  const windowHeight = Dimensions.get("window").height;
  const windowWidth = Dimensions.get("window").width;

  const spaceBelow = windowHeight - (layout.y + layout.height);
  const spaceAbove = layout.y;
  const menuMaxHeight = 300;

  const effectiveDirection =
    direction === "auto"
      ? spaceBelow < menuMaxHeight && spaceAbove > spaceBelow
        ? "up"
        : "down"
      : direction;

  const menuPosition =
    effectiveDirection === "up"
      ? { bottom: windowHeight - layout.y + 4 }
      : { top: layout.y + layout.height + 4 };
  const activeValue = selectedValue ?? label;
  const menuWidth = Math.max(layout.width + 28, 212);
  const menuLeft = Math.max(16, Math.min(layout.x, windowWidth - menuWidth - 16));

  return (
    <>
      <Pressable
        ref={containerRef}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: theme.backgroundElement,
          },
          pressed && styles.pressed,
          style,
        ]}
      >
        <View style={styles.content}>
          {icon &&
            (React.isValidElement(icon) ? (
              <View style={styles.icon}>{icon}</View>
            ) : (
              <SymbolView
                name={icon as any}
                tintColor={theme.textSecondary}
                size={14}
                style={styles.icon}
              />
            ))}
          <ThemedText style={[styles.label, labelStyle]} type="small">
            {label}
          </ThemedText>
          <SymbolView
            name={
              {
                ios: "chevron.down",
                android: "expand_more",
                web: "expand_more",
              } as any
            }
            tintColor={theme.textSecondary}
            size={12}
            style={styles.chevron}
          />
        </View>
      </Pressable>

      <Modal
        visible={isVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setIsVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsVisible(false)}
        >
          <View
            style={[
              styles.menuContainer,
              {
                backgroundColor:
                  theme.background === "#000000" ? "#1c1c1d" : "#f7f7f8",
                ...menuPosition,
                left: menuLeft,
                width: menuWidth,
                borderColor:
                  theme.background === "#000000"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.08)",
                maxHeight: menuMaxHeight,
              },
            ]}
          >
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const isActive =
                  option.value === activeValue || option.label === activeValue;

                return (
                  <Pressable
                    key={option.value}
                    style={({ pressed }) => [
                      styles.optionItem,
                      isActive && {
                        backgroundColor:
                          theme.background === "#000000"
                            ? "#262729"
                            : theme.backgroundElement,
                      },
                      pressed && {
                        backgroundColor:
                          theme.background === "#000000"
                            ? "#2d2f32"
                            : theme.backgroundSelected,
                      },
                    ]}
                    onPress={() => handleSelect(option)}
                  >
                    {option.icon &&
                      (React.isValidElement(option.icon) ? (
                        <View style={styles.optionIcon}>{option.icon}</View>
                      ) : (
                        <SymbolView
                          name={option.icon as any}
                          tintColor={theme.textSecondary}
                          size={16}
                          style={styles.optionIcon}
                        />
                      ))}
                    <ThemedText
                      style={[styles.optionLabel, isActive && styles.optionLabelActive]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </ThemedText>
                    {isActive && (
                      <SymbolView
                        name={
                          {
                            ios: "checkmark",
                            android: "check",
                            web: "check",
                          } as any
                        }
                        tintColor={theme.text}
                        size={14}
                        style={styles.checkIcon}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  icon: {
    opacity: 0.9,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.9,
  },
  chevron: {
    opacity: 0.6,
    marginLeft: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menuContainer: {
    position: "absolute",
    minWidth: 212,
    borderRadius: 18,
    padding: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 14,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  optionIcon: {
    opacity: 0.8,
  },
  optionLabel: {
    fontSize: 14,
    flex: 1,
    fontWeight: "500",
  },
  optionLabelActive: {
    fontWeight: "600",
  },
  checkIcon: {
    marginLeft: Spacing.one,
  },
});
