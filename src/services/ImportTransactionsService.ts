import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionRepository from '../repositories/TransactionsRepository';

interface TransactionCSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const contactsReadStream = fs.createReadStream(filePath);
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoryRepository = getRepository(Category);

    const parsers = csvParse({
      from_line: 2,
    });
    const transactions: TransactionCSV[] = [];
    const categories: string[] = [];

    const parceCSV = contactsReadStream.pipe(parsers);

    parceCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value || !category) {
        return;
      }

      categories.push(category);
      transactions.push({ title, type, value, category });
    });
    await new Promise(resolve => parceCSV.on('end', resolve));

    const existingCategories = await categoryRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existingCategoriesTitles = existingCategories.map(
      (category: Category) => category.title,
    );

    const categoriesTitlesToAdd = categories
      .filter(category => !existingCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoryRepository.create(
      categoriesTitlesToAdd.map(title => ({ title })),
    );

    await categoryRepository.save(newCategories);

    const finalCategories = [...newCategories, existingCategories];
    const createdTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );
    await transactionRepository.save(createdTransactions);
    await fs.promises.unlink(filePath);
    return createdTransactions;
  }
}

export default ImportTransactionsService;
