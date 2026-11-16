import { createFileRoute } from "@tanstack/react-router";
import { BrandPage } from "../pages/brand";

export const Route = createFileRoute("/brand")({ component: BrandPage });
