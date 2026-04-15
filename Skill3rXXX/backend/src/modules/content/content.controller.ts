import { Request, Response } from "express";
import * as ContentService from "./content.service";

export async function createPost(req: Request, res: Response): Promise<void> {
  const post = await ContentService.createPost(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: post });
}

export async function listPosts(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user!.role === "ADMIN";
  const posts = await ContentService.listPosts(req.user!.userId, isAdmin);
  res.json({ success: true, data: posts });
}

export async function getPost(req: Request, res: Response): Promise<void> {
  const post = await ContentService.getPost(req.params.id);
  res.json({ success: true, data: post });
}

export async function deletePost(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user!.role === "ADMIN";
  await ContentService.deletePost(req.params.id, req.user!.userId, isAdmin);
  res.json({ success: true, message: "Post deleted" });
}

export async function generateContent(req: Request, res: Response): Promise<void> {
  const post = await ContentService.generateContent(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: post });
}

export async function getStats(req: Request, res: Response): Promise<void> {
  const stats = await ContentService.getContentStats();
  res.json({ success: true, data: stats });
}
