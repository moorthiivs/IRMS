import { Skeleton, Stack } from '@mantine/core';

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Stack gap="md" mt="md">
      <Skeleton height={40} radius="sm" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={50} radius="sm" />
      ))}
    </Stack>
  );
}
