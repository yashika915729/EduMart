import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const client = await clientPromise;
        const db = client.db("EduMart");
        const usersCollection = db.collection("users");
        const productsCollection = db.collection("products");
        const cartsCollection = db.collection("carts");

        // --- VALIDATION: Check if the buyer has a contact number ---
        const buyer = await usersCollection.findOne({ email: session.user.email });
        if (!buyer || !buyer.contactNumber) {
            return NextResponse.json({ message: "Please add a contact number to your account before checking out." }, { status: 400 });
        }
        
        const cart = await cartsCollection.findOne({ userEmail: session.user.email });
        if (!cart || cart.items.length === 0) {
            return NextResponse.json({ message: "Your cart is empty." }, { status: 400 });
        }

        // --- Main Checkout Logic ---
        // Update all products in the cart
        await productsCollection.updateMany(
            { _id: { $in: cart.items.map(id => new ObjectId(id)) } },
            { 
                $set: { 
                    status: 'sold', 
                    buyerEmail: session.user.email 
                } 
            }
        );
        
        // Clear the user's cart
        await cartsCollection.updateOne(
            { userEmail: session.user.email },
            { $set: { items: [] } }
        );

        // In a real app, you would integrate a payment gateway here.
        // For now, we confirm the transaction was recorded in the database.
        
        return NextResponse.json({ success: true, message: "Checkout successful! Your items have been purchased." });
    } catch (error) {
        console.error("Checkout error:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}

