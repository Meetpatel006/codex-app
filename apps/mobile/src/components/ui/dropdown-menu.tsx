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
  style?: ViewStyle;
  labelStyle?: TextStyle;
  direction?: "up" | "down" | "auto";
}

export function DropdownMenu({
  label,
  icon,
  options = [],
  onSelect,
  style,
  labelStyle,
  direction = "auto",
}: DropdownMenuProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [layout, setLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<View>(null);
  const theme = useTheme();

  const handlePress = () => {
    Keyboard.dismiss();

    setTimeout(() => {
      containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
        setLayout({ x: pageX, y: pageY, width, height });
        setIsVisible(true);
      });
    }, 150);
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
        animationType="fade"
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
                backgroundColor: theme.backgroundSelected,
                ...menuPosition,
                left: Math.max(16, Math.min(layout.x, windowWidth - 220)),
                borderColor: theme.backgroundSelected,
                maxHeight: menuMaxHeight,
              },
            ]}
          >
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.optionItem,
                    pressed && { backgroundColor: theme.backgroundElement },
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
                  <ThemedText style={styles.optionLabel} numberOfLines={1}>
                    {option.label}
                  </ThemedText>
                  {option.label === label && (
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
              ))}
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
    minWidth: 200,
    borderRadius: 14,
    padding: 6,
    borderWidth: Platform.OS === "ios" ? 0 : 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
  },
  optionIcon: {
    opacity: 0.8,
  },
  optionLabel: {
    fontSize: 15,
    flex: 1,
    fontWeight: "500",
  },
  checkIcon: {
    marginLeft: Spacing.one,
  },
});
