const fs = require('fs');

let content = fs.readFileSync('src/pages/Reports.tsx', 'utf-8');

const groupedRecentNew = `  // Feature 2: Group Recent Inspections
  const groupedRecent = useMemo(() => {
    const groups: Record<string, any> = {};
    recent.forEach((tx: any) => {
      const dateStr = new Date(tx.inspectionTimestamp).toLocaleDateString();
      const custName = tx.part?.customer?.name || 'Unknown Customer';
      const partNo = tx.part?.partNumber || 'Unknown Part';
      const opNo = tx.operation?.operationNumber || 'Unknown Op';
      const mcNo = tx.mcNo || 'Unknown M/C';
      
      const l1 = \`\${custName} / \${partNo} - \${dateStr}\`;
      const l2 = opNo;
      const l3 = mcNo;

      if (!groups[l1]) groups[l1] = { txs: [], children: {} };
      groups[l1].txs.push(tx);

      if (!groups[l1].children[l2]) groups[l1].children[l2] = { txs: [], children: {} };
      groups[l1].children[l2].txs.push(tx);

      if (!groups[l1].children[l2].children[l3]) groups[l1].children[l2].children[l3] = { txs: [] };
      groups[l1].children[l2].children[l3].txs.push(tx);
    });
    return groups;
  }, [recent]);`;

content = content.replace(
  /  \/\/ Feature 2: Group Recent Inspections[\s\S]*?\}, \[recent\]\);/,
  groupedRecentNew
);

const renderNew = `                <Table.Tbody>
                  {Object.entries(groupedRecent).map(([l1Key, l1Node]: [string, any]) => (
                    <React.Fragment key={l1Key}>
                      {/* LEVEL 1 */}
                      <Table.Tr 
                        className={\`font-bold cursor-pointer transition-colors \${l1Node.txs.some((tx: any) => tx.status === 'REJECTED') ? 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 text-orange-900 dark:text-orange-200 border-b border-orange-200 dark:border-orange-900/50' : 'bg-white hover:bg-gray-50 dark:bg-[#1a1b1e] dark:hover:bg-[#25262b] border-b border-gray-200 dark:border-gray-800 shadow-sm'}\`}
                        onClick={() => toggleGroup(l1Key)}
                      >
                        <Table.Td colSpan={8} className="py-3">
                          <Group justify="space-between">
                            <Group gap="sm">
                              <ThemeIcon variant="light" color={expandedGroups[l1Key] ? "blue" : "gray"} size="sm" radius="xl">
                                {expandedGroups[l1Key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </ThemeIcon>
                              <Text size="sm" fw={700} className="text-gray-800 dark:text-gray-200">
                                {l1Key}
                              </Text>
                              <Badge size="xs" variant="filled" color="gray" radius="sm">{l1Node.txs.length} item{l1Node.txs.length > 1 ? 's' : ''}</Badge>
                            </Group>
                            <Group>
                              {l1Node.txs.some((tx: any) => tx.status === 'REJECTED') ? (
                                <Badge color="orange" variant="filled" size="sm">
                                  Take Action Required
                                </Badge>
                              ) : null}
                            </Group>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                      
                      {expandedGroups[l1Key] && Object.entries(l1Node.children).map(([l2Key, l2Node]: [string, any]) => {
                        const l2FullKey = \`\${l1Key}-\${l2Key}\`;
                        return (
                          <React.Fragment key={l2FullKey}>
                            {/* LEVEL 2 */}
                            <Table.Tr 
                              className="font-semibold cursor-pointer bg-slate-50 hover:bg-slate-100 dark:bg-[#25262b]/80 border-b border-gray-100 dark:border-gray-800"
                              onClick={() => toggleGroup(l2FullKey)}
                            >
                              <Table.Td colSpan={8} className="py-2 pl-12">
                                <Group justify="space-between">
                                  <Group gap="sm">
                                    <ThemeIcon variant="light" color={expandedGroups[l2FullKey] ? "blue" : "gray"} size="xs" radius="xl">
                                      {expandedGroups[l2FullKey] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </ThemeIcon>
                                    <Text size="sm" className="text-gray-700 dark:text-gray-300">
                                      Operation: {l2Key}
                                    </Text>
                                    <Badge size="xs" variant="light" color="gray">{l2Node.txs.length} items</Badge>
                                  </Group>
                                </Group>
                              </Table.Td>
                            </Table.Tr>

                            {expandedGroups[l2FullKey] && Object.entries(l2Node.children).map(([l3Key, l3Node]: [string, any]) => {
                              const l3FullKey = \`\${l2FullKey}-\${l3Key}\`;
                              return (
                                <React.Fragment key={l3FullKey}>
                                  {/* LEVEL 3 */}
                                  <Table.Tr 
                                    className="font-medium cursor-pointer bg-slate-100/50 hover:bg-slate-200/50 dark:bg-[#2c2e33]/50 border-b border-gray-50 dark:border-gray-800/50"
                                    onClick={() => toggleGroup(l3FullKey)}
                                  >
                                    <Table.Td colSpan={8} className="py-2 pl-20">
                                      <Group justify="space-between">
                                        <Group gap="sm">
                                          <ThemeIcon variant="light" color={expandedGroups[l3FullKey] ? "blue" : "gray"} size="xs" radius="xl">
                                            {expandedGroups[l3FullKey] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                          </ThemeIcon>
                                          <Text size="sm" className="text-gray-600 dark:text-gray-400">
                                            M/C No: {l3Key}
                                          </Text>
                                          <Badge size="xs" variant="dot" color="gray">{l3Node.txs.length} items</Badge>
                                        </Group>
                                        <Group>
                                          {isAdmin && l3Node.txs.some((tx: any) => tx.status === 'PASSED' && !tx.approvedById) ? (
                                            <Button
                                              size="compact-xs"
                                              color="green"
                                              onClick={(e) => { e.stopPropagation(); handleBulkApprove(l3Node.txs); }}
                                            >
                                              Bulk Approve
                                            </Button>
                                          ) : null}
                                        </Group>
                                      </Group>
                                    </Table.Td>
                                  </Table.Tr>

                                  {expandedGroups[l3FullKey] && l3Node.txs.map((item: any) => (
                                    <Table.Tr 
                                      key={item.id} 
                                      className={
                                        selectedIds.includes(item.id) ? 'bg-red-50/40 dark:bg-red-900/20' 
                                        : item.status === 'REJECTED' ? 'bg-orange-50/40 dark:bg-orange-900/20' 
                                        : 'bg-white hover:bg-slate-50 dark:bg-[#1a1b1e] dark:hover:bg-[#25262b] transition-colors'
                                      }
                                    >
                                      <Table.Td className="border-l-[3px] border-l-blue-400 pl-4">
                                        <Checkbox
                                          checked={selectedIds.includes(item.id)}
                                          onChange={(e) => {
                                            if (e.currentTarget.checked) {
                                              setSelectedIds(prev => [...prev, item.id]);
                                            } else {
                                              setSelectedIds(prev => prev.filter(id => id !== item.id));
                                            }
                                          }}
                                        />
                                      </Table.Td>
                                      <Table.Td>
                                        <Text size="sm" fw={500}>{new Date(item.inspectionTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                      </Table.Td>
                                      <Table.Td>
                                        <Text size="xs" c="dimmed">{item.part?.partNumber} / {item.operation?.operationNumber}</Text>
                                      </Table.Td>
                                      <Table.Td>
                                        <Badge variant="light" color="gray" size="sm">{item.shift?.name}</Badge>
                                      </Table.Td>
                                      <Table.Td>
                                        <Text size="sm" fw={500}>{item.lotNumber || '-'}</Text>
                                      </Table.Td>
                                      <Table.Td>
                                        <Text size="sm" c="dimmed">{item.inspector?.name}</Text>
                                      </Table.Td>
                                      <Table.Td>
                                        <Badge 
                                          color={item.status === 'PASSED' ? 'teal' : 'red'} 
                                          variant={item.status === 'PASSED' ? 'light' : 'filled'}
                                          size="sm"
                                        >
                                          {item.status}
                                        </Badge>
                                      </Table.Td>
                                      <Table.Td>
                                        <Group gap="xs" wrap="nowrap">
                                          <ActionIcon variant="light" color="blue" onClick={() => navigate(\`/reports/\${item.id}\`)}>
                                            <Eye size={16} />
                                          </ActionIcon>
                                          <ActionIcon variant="light" color="gray" onClick={() => navigate(\`/reports/\${item.id}\`)}>
                                            <Printer size={16} />
                                          </ActionIcon>
                                          {item.status === 'REJECTED' && (
                                            <Tooltip label="Take Action — Correct failed values">
                                              <ActionIcon
                                                variant="light"
                                                color="orange"
                                                onClick={() => handleTakeAction(item.id)}
                                              >
                                                <Wrench size={16} />
                                              </ActionIcon>
                                            </Tooltip>
                                          )}
                                          <Tooltip label="View Audit Trail">
                                            <ActionIcon
                                              variant="light"
                                              color="cyan"
                                              onClick={() => handleViewAuditTrail(item.id)}
                                            >
                                              <History size={16} />
                                            </ActionIcon>
                                          </Tooltip>
                                          {item.status === 'PASSED' && !item.approvedById && isAdmin && (
                                            <ActionIcon
                                              variant="light"
                                              color="violet"
                                              onClick={() => {
                                                setApprovalId(item.id);
                                                setReviewedChecked(false);
                                              }}
                                              loading={approveMutation.isPending && approvalId === item.id}
                                            >
                                              <FileCheck size={16} />
                                            </ActionIcon>
                                          )}
                                          {isAdmin && (
                                            <Tooltip label="Delete Report">
                                              <ActionIcon
                                                variant="light"
                                                color="red"
                                                onClick={() => handleDelete(item.id)}
                                                loading={deleteMutation.isPending}
                                              >
                                                <Trash2 size={16} />
                                              </ActionIcon>
                                            </Tooltip>
                                          )}
                                        </Group>
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                                </React.Fragment>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </Table.Tbody>`;

content = content.replace(
  /<Table\.Tbody>[\s\S]*?<\/Table\.Tbody>/,
  renderNew
);

fs.writeFileSync('src/pages/Reports.tsx', content, 'utf-8');
