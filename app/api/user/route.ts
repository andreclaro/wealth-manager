import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_USER_ID = "default-user";

// GET /api/user - Get current user profile
export async function GET() {
  try {
    let user = await prisma.user.findUnique({
      where: { id: DEFAULT_USER_ID },
    });

    // Create default user if not exists
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: DEFAULT_USER_ID,
          name: "Portfolio User",
          email: "user@example.com",
        },
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}

// PUT /api/user - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    let user = await prisma.user.findUnique({
      where: { id: DEFAULT_USER_ID },
    });

    if (user) {
      // Update existing user
      user = await prisma.user.update({
        where: { id: DEFAULT_USER_ID },
        data: { name, email },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          id: DEFAULT_USER_ID,
          name,
          email,
        },
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 }
    );
  }
}
