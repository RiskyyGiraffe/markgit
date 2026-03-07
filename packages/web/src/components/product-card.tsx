import Link from "next/link";
import type { ProductSummary } from "@tolty/sdk";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link href={`/marketplace/${product.id}`}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{product.name}</CardTitle>
            <span className="text-sm font-semibold text-primary">
              ${parseFloat(product.pricePerCallUsd).toFixed(4)}
            </span>
          </div>
          {product.category && (
            <Badge variant="secondary" className="w-fit">
              {product.category}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <CardDescription className="line-clamp-2">
            {product.description ?? "No description"}
          </CardDescription>
          {product.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {product.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
