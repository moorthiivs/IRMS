const fs = require('fs');

let content = fs.readFileSync('src/pages/Reports.tsx', 'utf-8');

const renderNew = `                <Table.Tbody>
                  {Object.entries(groupedRecent).map(([l1Key, l1Node]: [string, any]) => (
                    <React.Fragment key={l1Key}>
                      {/* LEVEL 1: Customer / Part */}
                      <Table.Tr 
                        className={\`cursor-pointer transition-colors \${l1Node.txs.some((tx: any) => tx.status === 'REJECTED') ? 'bg-orange-100 hover:bg-orange-200 text-orange-900' : 'bg-slate-700 hover:bg-slate-800 text-white border-b-2 border-slate-900'}\`}
                        onClick={() => toggleGroup(l1Key)}
                      >
                        <Table.Td colSpan={8} className="py-3">
                          <Group justify="space-between">
                            <Group gap="md">
                              <ActionIcon 
                                variant="transparent" 
                                color={l1Node.txs.some((tx: any) => tx.status === 'REJECTED') ? "orange" : "gray.1"}
                              >
                                {expandedGroups[l1Key] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </ActionIcon>
                              <Checkbox
                                color="blue"
                                checked={l1Node.txs.length > 0 && l1Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                indeterminate={l1Node.txs.some((t: any) => selectedIds.includes(t.id)) && !l1Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleSelectAll(e.currentTarget.checked, l1Node.txs.map((t: any) => t.id));
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Text size="md" fw={700}>
                                {l1Key}
                              </Text>
                              <Badge size="sm" variant="white" color="dark" radius="sm">{l1Node.txs.length} item{l1Node.txs.length > 1 ? 's' : ''}</Badge>
                            </Group>
                            <Group>
                              {l1Node.txs.some((tx: any) => tx.status === 'REJECTED') ? (
                                <Badge color="red" variant="filled" size="sm">
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
                            {/* LEVEL 2: Operation */}
                            <Table.Tr 
                              className="cursor-pointer bg-slate-200 hover:bg-slate-300 dark:bg-[#25262b] border-b border-slate-300 dark:border-gray-800"
                              onClick={() => toggleGroup(l2FullKey)}
                            >
                              <Table.Td colSpan={8} className="py-2.5">
                                <Group justify="space-between" ml="xl">
                                  <Group gap="md">
                                    <ActionIcon variant="transparent" color="dark">
                                      {expandedGroups[l2FullKey] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </ActionIcon>
                                    <Checkbox
                                      size="sm"
                                      color="blue"
                                      checked={l2Node.txs.length > 0 && l2Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                      indeterminate={l2Node.txs.some((t: any) => selectedIds.includes(t.id)) && !l2Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleSelectAll(e.currentTarget.checked, l2Node.txs.map((t: any) => t.id));
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <Text size="sm" fw={600} className="text-slate-800 dark:text-gray-200">
                                      Operation: {l2Key}
                                    </Text>
                                    <Badge size="xs" variant="filled" color="gray">{l2Node.txs.length} items</Badge>
                                  </Group>
                                </Group>
                              </Table.Td>
                            </Table.Tr>

                            {expandedGroups[l2FullKey] && Object.entries(l2Node.children).map(([l3Key, l3Node]: [string, any]) => {
                              const l3FullKey = \`\${l2FullKey}-\${l3Key}\`;
                              return (
                                <React.Fragment key={l3FullKey}>
                                  {/* LEVEL 3: M/C No */}
                                  <Table.Tr 
                                    className="cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-[#2c2e33]/50 border-b border-slate-200 dark:border-gray-800/50"
                                    onClick={() => toggleGroup(l3FullKey)}
                                  >
                                    <Table.Td colSpan={8} className="py-2">
                                      <Group justify="space-between" ml={60}>
                                        <Group gap="md">
                                          <ActionIcon variant="transparent" color="dark">
                                            {expandedGroups[l3FullKey] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                          </ActionIcon>
                                          <Checkbox
                                            size="sm"
                                            color="blue"
                                            checked={l3Node.txs.length > 0 && l3Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                            indeterminate={l3Node.txs.some((t: any) => selectedIds.includes(t.id)) && !l3Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              handleSelectAll(e.currentTarget.checked, l3Node.txs.map((t: any) => t.id));
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <Text size="sm" fw={600} className="text-slate-700 dark:text-gray-300">
                                            M/C No: {l3Key}
                                          </Text>
                                          <Badge size="xs" variant="outline" color="gray">{l3Node.txs.length} items</Badge>
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
                                      {/* No artificial padding left here to preserve table columns */}
                                      <Table.Td>
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
