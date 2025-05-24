import React from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TableViewProps {
  data: Array<Record<string, any>> | null;
  title?: string;
}

export function TableView({ data, title = "Query Results" }: TableViewProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>{title === "Query Results" ? "No data to display or query did not return results." : title}</p>
      </div>
    );
  }

  const headers = Object.keys(data[0]);

  const renderCellContent = (content: any): React.ReactNode => {
    if (typeof content === 'object' && content !== null) {
      // Basic serialization for objects/arrays within cells
      // In a real app, you might want more sophisticated rendering for nodes/relationships
      return <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(content, null, 2)}</pre>;
    }
    if (typeof content === 'boolean') {
      return content ? 'true' : 'false';
    }
    if (content === null || typeof content === 'undefined') {
      return <span className="text-muted-foreground/70">null</span>;
    }
    return String(content);
  };

  return (
    <div className="overflow-auto h-full p-1">
      <Table className="min-w-full">
        <TableCaption className="py-2">{title} (Displaying first {data.length} rows)</TableCaption>
        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header} className="font-semibold whitespace-nowrap px-3 py-2 text-sm">{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {headers.map((header) => (
                <TableCell key={`${rowIndex}-${header}`} className="px-3 py-2 text-sm align-top">
                  {renderCellContent(row[header])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 