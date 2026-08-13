import { useState, useMemo } from 'react';
import { Title, Paper, Text, Select, Group, Badge, Tooltip, SimpleGrid, ActionIcon } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Filter } from 'lucide-react';
import { inspectionService } from '../services/inspection.service';
import { masterDataService } from '../services/master-data.service';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, addMonths, subMonths,
  isSameMonth, isToday, isSameDay,
} from 'date-fns';

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarDayData {
  date: string;
  totalReports: number;
  passedCount: number;
  rejectedCount: number;
  approvedCount: number;
  pendingApprovalCount: number;
  shifts: Array<{ shiftName: string; reportCount: number; passedCount: number; rejectedCount: number }>;
  allComplete: boolean;
}

export function InspectionCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDayData | null>(null);

  // Data queries
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => masterDataService.getCustomers(),
  });

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: () => masterDataService.getParts(),
  });

  const { data: partsWithOps = [] } = useQuery({
    queryKey: ['parts-with-operations'],
    queryFn: () => masterDataService.getPartsWithOperations(),
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: calendarData = [] } = useQuery({
    queryKey: ['inspection-calendar', format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd'), selectedCustomer, selectedPart, selectedOperation],
    queryFn: () => inspectionService.getCalendarData({
      startDate: format(monthStart, 'yyyy-MM-dd'),
      endDate: format(monthEnd, 'yyyy-MM-dd'),
      customerId: selectedCustomer || undefined,
      partId: selectedPart || undefined,
      operationId: selectedOperation || undefined,
    }),
  });

  // Create date-keyed lookup map
  const dayDataMap = useMemo(() => {
    const map: Record<string, CalendarDayData> = {};
    calendarData.forEach((d: CalendarDayData) => {
      map[d.date] = d;
    });
    return map;
  }, [calendarData]);

  // Generate calendar grid dates (includes padding from prev/next month)
  const calendarDates = useMemo(() => {
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [monthStart, monthEnd]);

  // Summary stats for the month
  const monthSummary = useMemo(() => {
    let totalReports = 0;
    let totalPassed = 0;
    let totalRejected = 0;
    let totalApproved = 0;
    let totalPending = 0;
    let daysWithReports = 0;

    calendarData.forEach((d: CalendarDayData) => {
      totalReports += d.totalReports;
      totalPassed += d.passedCount;
      totalRejected += d.rejectedCount;
      totalApproved += d.approvedCount;
      totalPending += d.pendingApprovalCount;
      if (d.totalReports > 0) daysWithReports++;
    });

    return { totalReports, totalPassed, totalRejected, totalApproved, totalPending, daysWithReports };
  }, [calendarData]);

  const getStatusColor = (dayData: CalendarDayData | undefined) => {
    if (!dayData || dayData.totalReports === 0) return 'gray';
    if (dayData.rejectedCount > 0) return 'red';
    if (dayData.pendingApprovalCount > 0) return 'orange';
    return 'green';
  };

  const getStatusLabel = (dayData: CalendarDayData | undefined) => {
    if (!dayData || dayData.totalReports === 0) return 'No Reports';
    if (dayData.rejectedCount > 0) return 'Has Rejections';
    if (dayData.pendingApprovalCount > 0) return 'Pending Approval';
    return 'All Passed & Approved';
  };

  const getShiftBadgeColor = (shift: { passedCount: number; rejectedCount: number }) => {
    if (shift.rejectedCount > 0) return 'red';
    return 'green';
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <Paper p="md" radius="lg" withBorder className="bg-white dark:bg-gray-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Title order={2} className="text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <CalendarDays className="text-blue-600 dark:text-blue-400" size={26} />
              Inspection Report Calendar
            </Title>
            <Text size="sm" c="dimmed">
              Monthly calendar view of inspection report completion, pass/fail status, approvals & shift coverage
            </Text>
          </div>
          <Group gap="xs">
            <Badge color="blue" variant="light" size="lg">
              {monthSummary.totalReports} Reports in {format(currentMonth, 'MMMM yyyy')}
            </Badge>
          </Group>
        </div>

        {/* Filters */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" className="pt-2 border-t">
          <Select
            label="Filter Customer"
            placeholder="All Customers"
            data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
            value={selectedCustomer}
            onChange={(v) => { setSelectedCustomer(v); setSelectedPart(null); setSelectedOperation(null); }}
            clearable
            searchable
            leftSection={<Filter size={14} />}
          />
          <Select
            label="Filter Part Number"
            placeholder="All Parts"
            data={parts.map((p: any) => ({ value: p.id, label: `${p.partNumber} - ${p.partName}` }))}
            value={selectedPart}
            onChange={setSelectedPart}
            clearable
            searchable
          />
          <Select
            label="Filter Operation"
            placeholder="All Operations"
            data={Array.from(
              new Map<string, { value: string; label: string }>(
                partsWithOps.flatMap((p: any) => (p.operations || []).map((op: any) => [op.id, { value: op.id, label: `${op.operationNumber} - ${op.operationName}` }]))
              ).values()
            )}
            value={selectedOperation}
            onChange={setSelectedOperation}
            clearable
            searchable
          />
        </SimpleGrid>
      </Paper>

      {/* Month Summary Cards */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
        <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
          <Paper withBorder p="sm" radius="lg" className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800/80 text-center">
            <Text size="xs" c="dimmed" fw={700} className="uppercase tracking-wider">Total Reports</Text>
            <Text size="xl" fw={800} className="text-blue-700 dark:text-blue-300">{monthSummary.totalReports}</Text>
          </Paper>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
          <Paper withBorder p="sm" radius="lg" className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800/80 text-center">
            <Text size="xs" c="dimmed" fw={700} className="uppercase tracking-wider">Passed</Text>
            <Text size="xl" fw={800} className="text-emerald-700 dark:text-emerald-300">{monthSummary.totalPassed}</Text>
          </Paper>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
          <Paper withBorder p="sm" radius="lg" className="bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800/80 text-center">
            <Text size="xs" c="dimmed" fw={700} className="uppercase tracking-wider">Rejected</Text>
            <Text size="xl" fw={800} className="text-red-700 dark:text-red-300">{monthSummary.totalRejected}</Text>
          </Paper>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
          <Paper withBorder p="sm" radius="lg" className="bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800/80 text-center">
            <Text size="xs" c="dimmed" fw={700} className="uppercase tracking-wider">Approved</Text>
            <Text size="xl" fw={800} className="text-green-700 dark:text-green-300">{monthSummary.totalApproved}</Text>
          </Paper>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
          <Paper withBorder p="sm" radius="lg" className="bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800/80 text-center">
            <Text size="xs" c="dimmed" fw={700} className="uppercase tracking-wider">Pending Approval</Text>
            <Text size="xl" fw={800} className="text-orange-700 dark:text-orange-300">{monthSummary.totalPending}</Text>
          </Paper>
        </motion.div>
      </SimpleGrid>

      {/* Calendar */}
      <Paper withBorder p="md" radius="lg" className="shadow-sm bg-white dark:bg-gray-800">
        {/* Month Navigation */}
        <div className="flex justify-between items-center mb-4">
          <ActionIcon variant="light" color="blue" size="lg" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft size={20} />
          </ActionIcon>
          <Title order={3} className="text-gray-900 dark:text-gray-100">
            {format(currentMonth, 'MMMM yyyy')}
          </Title>
          <ActionIcon variant="light" color="blue" size="lg" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight size={20} />
          </ActionIcon>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_HEADERS.map((day) => (
            <div key={day} className="text-center py-2">
              <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider">{day}</Text>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDates.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayData = dayDataMap[dateKey];
            const inCurrentMonth = isSameMonth(date, currentMonth);
            const today = isToday(date);
            const statusColor = getStatusColor(dayData);
            const isSelected = selectedDay && isSameDay(new Date(selectedDay.date), date);

            return (
              <Tooltip
                key={dateKey}
                multiline
                w={260}
                position="top"
                withArrow
                disabled={!dayData || dayData.totalReports === 0}
                label={dayData && dayData.totalReports > 0 ? (
                  <div>
                    <Text fw={700} size="sm" mb={4}>{format(date, 'dd MMMM yyyy')}</Text>
                    <Text size="xs">Total Reports: {dayData.totalReports}</Text>
                    <Text size="xs" c="green">✓ Passed: {dayData.passedCount}</Text>
                    <Text size="xs" c="red">✗ Failed: {dayData.rejectedCount}</Text>
                    <Text size="xs" c="green">✓ Approved: {dayData.approvedCount}</Text>
                    <Text size="xs" c="orange">◷ Pending Approval: {dayData.pendingApprovalCount}</Text>
                    {dayData.shifts.length > 0 && (
                      <>
                        <Text size="xs" fw={600} mt={4}>Shifts:</Text>
                        {dayData.shifts.map((s, i) => (
                          <Text key={i} size="xs">
                            {s.shiftName}: {s.reportCount} reports ({s.passedCount}✓ / {s.rejectedCount}✗)
                          </Text>
                        ))}
                      </>
                    )}
                  </div>
                ) : null}
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  onClick={() => dayData && dayData.totalReports > 0 ? setSelectedDay(dayData) : setSelectedDay(null)}
                  className={`
                    min-h-[90px] p-1.5 rounded-lg border cursor-pointer transition-all duration-150
                    ${!inCurrentMonth ? 'opacity-30' : ''}
                    ${today ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                    ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 shadow-lg' : ''}
                    ${dayData && dayData.totalReports > 0
                      ? statusColor === 'green'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                        : statusColor === 'red'
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
                          : statusColor === 'orange'
                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                            : 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                      : 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  {/* Date Number */}
                  <div className="flex justify-between items-start">
                    <Text
                      size="sm"
                      fw={today ? 800 : 600}
                      className={today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}
                    >
                      {format(date, 'd')}
                    </Text>
                    {dayData && dayData.totalReports > 0 && (
                      <Badge
                        size="xs"
                        variant="filled"
                        color={statusColor}
                        className="px-1"
                      >
                        {dayData.totalReports}
                      </Badge>
                    )}
                  </div>

                  {/* Status Indicator */}
                  {dayData && dayData.totalReports > 0 && inCurrentMonth && (
                    <div className="mt-1 space-y-0.5">
                      {/* Pass/Fail Mini Summary */}
                      <div className="flex items-center gap-0.5">
                        {dayData.passedCount > 0 && (
                          <div className="flex items-center gap-0.5">
                            <CheckCircle2 size={10} className="text-emerald-600" />
                            <Text size="xs" c="green" fw={600}>{dayData.passedCount}</Text>
                          </div>
                        )}
                        {dayData.rejectedCount > 0 && (
                          <div className="flex items-center gap-0.5 ml-1">
                            <XCircle size={10} className="text-red-600" />
                            <Text size="xs" c="red" fw={600}>{dayData.rejectedCount}</Text>
                          </div>
                        )}
                        {dayData.pendingApprovalCount > 0 && (
                          <div className="flex items-center gap-0.5 ml-1">
                            <Clock size={10} className="text-amber-600" />
                            <Text size="xs" c="orange" fw={600}>{dayData.pendingApprovalCount}</Text>
                          </div>
                        )}
                      </div>

                      {/* Shift Indicators */}
                      {dayData.shifts.length > 0 && (
                        <div className="flex gap-0.5 flex-wrap">
                          {dayData.shifts.map((s, i) => (
                            <Badge
                              key={i}
                              size="xs"
                              variant="dot"
                              color={getShiftBadgeColor(s)}
                              className="px-1"
                              styles={{ root: { textTransform: 'none', fontSize: '9px' } }}
                            >
                              {s.shiftName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </Tooltip>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t flex flex-wrap gap-4 justify-center">
          <Group gap={4}>
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <Text size="xs" c="dimmed">All Passed & Approved</Text>
          </Group>
          <Group gap={4}>
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <Text size="xs" c="dimmed">Pending Approval</Text>
          </Group>
          <Group gap={4}>
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <Text size="xs" c="dimmed">Has Rejections</Text>
          </Group>
          <Group gap={4}>
            <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
            <Text size="xs" c="dimmed">No Reports</Text>
          </Group>
          <Group gap={4}>
            <div className="w-3 h-3 rounded ring-2 ring-blue-500" />
            <Text size="xs" c="dimmed">Today</Text>
          </Group>
        </div>
      </Paper>

      {/* Selected Day Detail Panel */}
      {selectedDay && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Paper withBorder p="md" radius="lg" className="shadow-sm bg-white dark:bg-gray-800 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <Title order={4} className="flex items-center gap-2">
                  <CalendarDays size={18} />
                  {format(new Date(selectedDay.date), 'EEEE, dd MMMM yyyy')}
                </Title>
                <Text size="sm" c="dimmed">Detailed breakdown of inspection reports for this date</Text>
              </div>
              <Badge
                size="lg"
                color={getStatusColor(selectedDay)}
                variant="light"
              >
                {getStatusLabel(selectedDay)}
              </Badge>
            </div>

            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
              <Paper withBorder p="sm" radius="md" className="text-center bg-blue-50 dark:bg-blue-900/20">
                <Text size="xs" c="dimmed" fw={700}>Total Reports</Text>
                <Text size="lg" fw={800}>{selectedDay.totalReports}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md" className="text-center bg-emerald-50 dark:bg-emerald-900/20">
                <Text size="xs" c="dimmed" fw={700}>Passed</Text>
                <Text size="lg" fw={800} c="green">{selectedDay.passedCount}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md" className="text-center bg-red-50 dark:bg-red-900/20">
                <Text size="xs" c="dimmed" fw={700}>Rejected</Text>
                <Text size="lg" fw={800} c="red">{selectedDay.rejectedCount}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md" className="text-center bg-green-50 dark:bg-green-900/20">
                <Text size="xs" c="dimmed" fw={700}>Approved</Text>
                <Text size="lg" fw={800} c="teal">{selectedDay.approvedCount}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md" className="text-center bg-orange-50 dark:bg-orange-900/20">
                <Text size="xs" c="dimmed" fw={700}>Pending</Text>
                <Text size="lg" fw={800} c="orange">{selectedDay.pendingApprovalCount}</Text>
              </Paper>
            </SimpleGrid>

            {/* Shift Breakdown */}
            {selectedDay.shifts.length > 0 && (
              <div>
                <Text fw={700} size="sm" mb="xs">Shift Coverage Breakdown</Text>
                <div className="flex gap-3 flex-wrap">
                  {selectedDay.shifts.map((s, i) => (
                    <Paper
                      key={i}
                      withBorder
                      p="sm"
                      radius="md"
                      className={`min-w-[140px] ${
                        s.rejectedCount > 0
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-300'
                          : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300'
                      }`}
                    >
                      <Text fw={700} size="sm" mb={2}>{s.shiftName}</Text>
                      <Text size="xs">{s.reportCount} reports</Text>
                      <Group gap={6} mt={4}>
                        <Badge size="xs" color="green" variant="light">{s.passedCount} Pass</Badge>
                        {s.rejectedCount > 0 && <Badge size="xs" color="red" variant="light">{s.rejectedCount} Fail</Badge>}
                      </Group>
                    </Paper>
                  ))}
                </div>
              </div>
            )}
          </Paper>
        </motion.div>
      )}
    </div>
  );
}
