'use server';
import {z} from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
//import State from '../../node_modules/sucrase/dist/types/parser/tokenizer/state.d';
import { errors } from '../../node_modules/@swc/helpers/scripts/errors';

export type State = {
  errors?: {
    customerId?: string[];
  amount?: string[];
  status?: string[];
  };
  message?: string | null;
};

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
      invalid_type_error: 'Please select a customer',
    }),
    amount: z.coerce.number().gt(0, {message: 'Please enter an amount greater than $0'}),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select a status',
    
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true});

export async function createInvoice(prevState: State, formData: FormData){

    
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });

    //If form validation fails, return errors early. Otherwise, continue with the database operation.
    if(!validatedFields.success){
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to create invoice.'
      };
    }
    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];
    try{
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date});
        `;

    // const rawFormData = Object.fromEntries(formData.entries());
    console.log(typeof(amount));
    console.log(validatedFields);
    }catch(e){
        return {
            message: 'Database Error: Failed to create invoice.',
        };
    }
    /*
    Once the database has been updated, the /dashboard/invoices path 
    will be revalidated, and fresh data will be fetched from the server.
    */
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
    const amountInCents = amount * 100;
   try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
   }catch(e){
    return {
        message: 'Database Error: Failed to update invoice.',
    };
   }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  }

  export async function deleteInvoice(id: string) {
    
    try {
    await sql`DELETE FROM invoices WHERE id=${id}`;

    revalidatePath('/dashboard/invoices');
    return { message: 'Deleted invoice.'};

    }catch(e){
        return {
            message: 'Database Error: Failed to delete invoice.',
        };
    }
  }