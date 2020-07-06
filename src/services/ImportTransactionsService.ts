import csvParse from 'csv-parse';
import fs from 'fs';
import Transaction from '../models/Transaction';

interface TransactionCSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const contactsReadStream = fs.createReadStream(filePath);

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
  }
}

export default ImportTransactionsService;
