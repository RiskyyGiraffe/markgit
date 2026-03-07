import { listPurchases, listExecutions } from "@/actions/purchases";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExecutionDetailDialog } from "@/components/execution-detail-dialog";

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "failed":
    case "timed_out":
      return "destructive";
    case "running":
    case "pending":
      return "secondary";
    default:
      return "outline";
  }
}

export default async function HistoryPage() {
  const [purchases, executions] = await Promise.all([
    listPurchases(),
    listExecutions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">
          View your purchase and execution history
        </p>
      </div>

      <Tabs defaultValue="purchases">
        <TabsList>
          <TabsTrigger value="purchases">
            Purchases ({purchases.total})
          </TabsTrigger>
          <TabsTrigger value="executions">
            Executions ({executions.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="purchases">
          <Card>
            <CardHeader>
              <CardTitle>Purchases</CardTitle>
              <CardDescription>Your API purchase history</CardDescription>
            </CardHeader>
            <CardContent>
              {purchases.results.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No purchases yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.results.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-medium">
                          {purchase.productName}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(purchase.status)}>
                            {purchase.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          ${parseFloat(purchase.totalUsd).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(purchase.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions">
          <Card>
            <CardHeader>
              <CardTitle>Executions</CardTitle>
              <CardDescription>Your API execution history</CardDescription>
            </CardHeader>
            <CardContent>
              {executions.results.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No executions yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.results.map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell className="font-medium">
                          {execution.productName}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(execution.status)}>
                            {execution.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(execution.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <ExecutionDetailDialog execution={execution} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
