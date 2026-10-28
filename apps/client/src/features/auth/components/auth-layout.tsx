import { getAppName } from "@/lib/config";
import React from "react";
import { Group, Text } from "@mantine/core";
import classes from "./auth.module.css";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <>
      <Group justify="center" gap={8} className={classes.logo}>
        <img
          src="/icons/coders-docs.svg"
          alt={getAppName()}
          width={22}
          height={22}
        />
        <Text size="28px" fw={700} style={{ userSelect: "none" }}>
          {getAppName()}
        </Text>
      </Group>
      <main>{children}</main>
    </>
  );
}
