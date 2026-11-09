import type { Request, Response } from "express";
import { expenseService } from "./expense.service";
import { AppError } from "../../lib/errors";

export class ExpenseController {
  async getSummary(req: Request, res: Response) {
    const user = req.user!;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const summary = await expenseService.getSummary(user, year);
    res.status(200).json(summary);
  }

  async list(req: Request, res: Response) {
    const user = req.user!;
    const result = await expenseService.listClaims(user, req.query as any);
    res.status(200).json(result);
  }

  async create(req: Request, res: Response) {
    const user = req.user!;
    const claim = await expenseService.createClaim(user, req.body);
    res.status(201).json(claim);
  }

  async getById(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const claim = await expenseService.getClaimDetails(user, id);
    res.status(200).json(claim);
  }

  async update(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const claim = await expenseService.updateClaim(user, id, req.body);
    res.status(200).json(claim);
  }

  async delete(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const result = await expenseService.deleteClaim(user, id);
    res.status(200).json(result);
  }

  async addItem(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const result = await expenseService.addItem(user, id, req.body);
    res.status(201).json(result);
  }

  async updateItem(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const itemId = req.params.itemId as string;
    const result = await expenseService.updateItem(user, id, itemId, req.body);
    res.status(200).json(result);
  }

  async deleteItem(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const itemId = req.params.itemId as string;
    const result = await expenseService.deleteItem(user, id, itemId);
    res.status(200).json(result);
  }

  async submit(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const claim = await expenseService.submitClaim(user, id);
    res.status(200).json(claim);
  }

  async pay(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id as string;
    const { paymentReference } = req.body;
    const claim = await expenseService.markAsPaid(user, id, paymentReference);
    res.status(200).json(claim);
  }

  async markAsPaid(req: Request, res: Response) {
    return this.pay(req, res);
  }

  async uploadReceipt(req: Request, res: Response) {
    const user = req.user!;
    let file = req.file;
    if (!file && req.files) {
      const filesObj = req.files as Record<string, Express.Multer.File[]>;
      file = filesObj.receipt?.[0] || filesObj.file?.[0];
    }
    if (!file) {
      throw AppError.badRequest("No receipt file was provided");
    }

    const result = await expenseService.uploadReceipt(file, user);
    res.status(201).json(result);
  }

  async getReceiptFile(req: Request, res: Response) {
    const user = req.user!;
    const filename = req.params.filename as string;
    const { stream, mimeType, fileName } = await expenseService.getReceiptFile(filename, user);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    stream.pipe(res);
  }
}

export const expenseController = new ExpenseController();
