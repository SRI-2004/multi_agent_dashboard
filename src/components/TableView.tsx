import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
  ColumnDef,
  VisibilityState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown } from 'lucide-react';

interface TableViewProps {
  data: Array<Record<string, any>> | null;
  title?: string;
}

// Simple popover for menus (replace with Radix/Headless UI if available)
function Popover({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <span onClick={() => setOpen((v) => !v)} className="cursor-pointer select-none">{trigger}</span>
      {open && (
        <div className="absolute z-50 mt-2 min-w-[140px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded shadow-lg p-2 text-sm" onMouseLeave={() => setOpen(false)}>
          {children}
        </div>
      )}
    </span>
  );
}

function computeAggregate(data: any[], key: string, fn: 'max' | 'min' | 'avg' | 'sum' | 'count') {
  const values = data.map(row => row[key]).filter(v => typeof v === 'number');
  if (!values.length) return null;
  switch (fn) {
    case 'max': return Math.max(...values);
    case 'min': return Math.min(...values);
    case 'avg': return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'count': return values.length;
    default: return null;
  }
}

export function TableView({ data, title = "Query Results" }: TableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [aggMenu, setAggMenu] = useState<{ [key: string]: string | null }>({});

  const columns = useMemo<ColumnDef<any, any>[]>(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).map((key) => ({
      accessorKey: key,
      header: () => (
        <Popover
          trigger={
            <span className="font-semibold whitespace-nowrap px-3 py-2 text-sm flex items-center gap-1">
              {key}
              <ChevronDown size={16} className="inline-block text-muted-foreground/80 ml-1" />
            </span>
          }
        >
          <div className="flex flex-col gap-1">
            <button className="hover:bg-accent px-2 py-1 rounded text-left" onClick={() => setSorting([{ id: key, desc: false }])}>Sort A-Z</button>
            <button className="hover:bg-accent px-2 py-1 rounded text-left" onClick={() => setSorting([{ id: key, desc: true }])}>Sort Z-A</button>
            <hr className="my-1" />
            <span className="font-medium text-xs text-muted-foreground">Aggregate:</span>
            {['max', 'min', 'avg', 'sum', 'count'].map(fn => (
              <button
                key={fn}
                className="hover:bg-accent px-2 py-1 rounded text-left"
                onClick={() => setAggMenu(prev => ({ ...prev, [key]: fn }))}
              >
                {fn.charAt(0).toUpperCase() + fn.slice(1)}
              </button>
            ))}
            <button className="hover:bg-accent px-2 py-1 rounded text-left" onClick={() => setAggMenu(prev => ({ ...prev, [key]: null }))}>Clear Aggregate</button>
          </div>
        </Popover>
      ),
      cell: info => {
        const value = info.getValue();
        if (typeof value === 'object' && value !== null) {
          return <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>;
        }
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (value === null || typeof value === 'undefined') return <span className="text-muted-foreground/70">null</span>;
        return String(value);
      },
    }));
  }, [data, setSorting, setAggMenu]);

  const table = useReactTable({
    data: data || [],
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: false,
  });

  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>{title === "Query Results" ? "No data to display or query did not return results." : title}</p>
      </div>
    );
  }

  // Column chooser UI
  const allColumns = table.getAllLeafColumns();

  return (
    <div className="overflow-auto h-full p-1">
      <div className="flex items-center gap-2 mb-2">
        <Popover trigger={<button className="border rounded px-2 py-1 text-xs">Choose Columns</button>}>
          <div className="flex flex-col gap-1">
            {allColumns.map(col => (
              <label key={col.id} className="flex items-center gap-2 px-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  onChange={() => col.toggleVisibility()}
                />
                <span>{col.id}</span>
              </label>
            ))}
          </div>
        </Popover>
      </div>
      <Table className="min-w-full">
        <TableCaption className="py-2">{title} (Displaying first {data.length} rows)</TableCaption>
        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} colSpan={header.colSpan} className="font-semibold whitespace-nowrap px-3 py-2 text-sm">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  {aggMenu[header.column.id] && !header.isPlaceholder && (
                    <span className="ml-2 text-xs text-blue-600 font-mono">
                      {aggMenu[header.column.id]}: {computeAggregate(data, header.column.id, aggMenu[header.column.id] as any)}
                    </span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id} className="px-3 py-2 text-sm align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 