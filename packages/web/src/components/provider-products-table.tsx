"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  publishProviderProduct,
  submitProviderProduct,
} from "@/actions/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type ProviderProduct = {
  id: string;
  name: string;
  slug: string;
  status: string;
  pricePerCallUsd: string;
  updatedAt: string;
};

export function ProviderProductsTable({
  products,
}: {
  products: ProviderProduct[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (
    productId: string,
    action: "submit" | "publish",
  ) => {
    setLoadingId(productId);

    try {
      if (action === "submit") {
        await submitProviderProduct(productId);
        toast.success("Product submitted for review");
      } else {
        await publishProviderProduct(productId);
        toast.success("Product published");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Product update failed");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Products</CardTitle>
        <CardDescription>Create, review, and publish product listings</CardDescription>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No products yet
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isLoading = loadingId === product.id;

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {product.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.status === "active" ? "default" : "secondary"}>
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell>${parseFloat(product.pricePerCallUsd).toFixed(4)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(product.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="flex gap-2">
                      {product.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => handleAction(product.id, "submit")}
                        >
                          {isLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Submit
                        </Button>
                      )}
                      {(product.status === "draft" || product.status === "pending_review") && (
                        <Button
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleAction(product.id, "publish")}
                        >
                          {isLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Publish
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
