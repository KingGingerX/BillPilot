import { Request, Response } from "express";
import * as ProductsService from "./products.service";
import { ProductStatus } from "@prisma/client";

export async function createProduct(req: Request, res: Response): Promise<void> {
  const product = await ProductsService.createProduct(req.body);
  res.status(201).json({ success: true, data: product });
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  const status = req.query.status as ProductStatus | undefined;
  const products = await ProductsService.listProducts(status);
  res.json({ success: true, data: products });
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const product = await ProductsService.getProduct(req.params.id);
  res.json({ success: true, data: product });
}

export async function getProductBySlug(req: Request, res: Response): Promise<void> {
  const product = await ProductsService.getProductBySlug(req.params.slug);
  res.json({ success: true, data: product });
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const product = await ProductsService.updateProduct(req.params.id, req.body);
  res.json({ success: true, data: product });
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  await ProductsService.deleteProduct(req.params.id);
  res.json({ success: true, message: "Product archived" });
}

export async function createCheckout(req: Request, res: Response): Promise<void> {
  const { productId, affiliateCode, successUrl, cancelUrl } = req.body;
  const result = await ProductsService.createCheckoutSession(
    req.user!.userId,
    productId,
    affiliateCode,
    successUrl,
    cancelUrl
  );
  res.json({ success: true, data: result });
}

export async function getDownloadUrl(req: Request, res: Response): Promise<void> {
  const url = await ProductsService.getDownloadUrl(req.params.id, req.user!.userId);
  res.json({ success: true, data: { downloadToken: url } });
}

export async function getProductRevenue(req: Request, res: Response): Promise<void> {
  const data = await ProductsService.getProductRevenue();
  res.json({ success: true, data });
}
