import { getProduct } from "@/actions/marketplace";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductExecuteForm } from "@/components/product-execute-form";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {product.name}
            </h1>
            <p className="text-muted-foreground">{product.description}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">
              ${parseFloat(product.pricePerCallUsd).toFixed(4)}
            </p>
            <p className="text-sm text-muted-foreground">per call</p>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          {product.category && (
            <Badge variant="secondary">{product.category}</Badge>
          )}
          <Badge variant="outline">{product.status}</Badge>
          {product.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Execute</CardTitle>
            <CardDescription>
              Fill in the parameters and run this API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductExecuteForm
              productId={product.id}
              inputSchema={product.inputSchema as Record<string, unknown> | null}
              executionConfig={product.executionConfig as Record<string, unknown> | null}
              buyerCredentialConfigured={product.buyerCredentialConfigured}
            />
          </CardContent>
        </Card>

        {product.inputSchema && (
          <Card>
            <CardHeader>
              <CardTitle>Input Schema</CardTitle>
              <CardDescription>Expected parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-lg bg-muted p-4 text-sm">
                {JSON.stringify(product.inputSchema, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
