"use client";

import React, { useState } from "react";
import axios, { AxiosError } from "axios";

interface ProductFormProps {
    onClose: () => void;
    onProductAdded: () => void;
}

const months = [
    "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
    "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"
];

const ProductForm: React.FC<ProductFormProps> = ({ onClose, onProductAdded }) => {
    const [productData, setProductData] = useState({
        codigo: "",
        descripcion: "",
        unidCaja: "",
        stockTotal: "",
        consumos: Array(12).fill(0),
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        index?: number
    ) => {
        const { name, value } = e.target;
        if (index !== undefined) {
            // Validar que el valor ingresado no sea negativo
            const newValue = Math.max(0, Number(value)); // Se asegura que el valor no sea negativo
            const newConsumos = [...productData.consumos];
            newConsumos[index] = newValue;
            setProductData({ ...productData, consumos: newConsumos });
        } else {
            setProductData({ ...productData, [name]: value });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
    
        const { codigo, descripcion, unidCaja, stockTotal, consumos } = productData;
    
        if (!codigo || !descripcion || !unidCaja || !stockTotal) {
            alert("Todos los campos son obligatorios");
            return;
        }
    
        if (consumos.filter((c) => c > 0).length < 5) {
            alert("Debe ingresar al menos 5 consumos.");
            return;
        }
    
        // Verificar si el código de producto ya existe antes de enviar la solicitud
        try {
            const checkResponse = await axios.get(`http://localhost:3500/api/products/${codigo}`);
    
            if (checkResponse.status === 200) {
                alert("El código de producto ya existe. Por favor, use otro código.");
                return; // Si el código ya existe, no enviamos el formulario
            }
        } catch (error: unknown) { // Definir error como unknown
            if (axios.isAxiosError(error)) {
                if (error.response && error.response.status === 404) {
                    // Si el producto no existe (código no existe), proceder con la creación
                    const formattedConsumos: { [key: string]: number } = months.reduce((acc, month, index) => {
                        acc[month + " 2024"] = consumos[index];
                        return acc;
                    }, {} as { [key: string]: number });
    
                    try {
                        const response = await axios.post("http://localhost:3500/api/products", {
                            codigo,
                            descripcion,
                            unidCaja: Number(unidCaja),
                            stockTotal: Number(stockTotal),
                            consumos: formattedConsumos,
                        });
    
                        if (response.status === 200) {
                            onProductAdded();
                            onClose();
                            alert("Producto guardado correctamente");
                        }
                    } catch (error: unknown) { // Definir error como unknown
                        if (axios.isAxiosError(error)) {
                            console.error("Error al guardar el producto:", error.response?.data);
                            alert("Hubo un error al intentar guardar el producto: " + error.response?.data.message);
                        } else {
                            console.error("Error desconocido:", error);
                            alert("Hubo un error al intentar guardar el producto.");
                        }
                    }
                } else {
                    console.error("Error inesperado:", error);
                    alert("Hubo un error al verificar el producto.");
                }
            } else {
                console.error("Error desconocido:", error);
                alert("Hubo un error al intentar verificar el producto.");
            }
        }
    };
    
    return (
        <div className="fixed inset-0 bg-slate-500/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form
                onSubmit={handleSubmit}
                className="bg-white w-full max-w-2xl rounded-xl p-8 space-y-6 shadow-xl border border-slate-200"
            >
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-900">Nuevo Producto</h2>
                    <button type="button" onClick={onClose} className="text-slate-600 hover:text-slate-800">
                        ✕
                    </button>
                </div>
    
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-900">Código</label>
                            <input
                                type="text"
                                name="codigo"
                                value={productData.codigo}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900 bg-slate-100"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-900">Descripción</label>
                            <input
                                type="text"
                                name="descripcion"
                                value={productData.descripcion}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900 bg-slate-100"
                            />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-900">Unidad/Caja</label>
                            <input
                                type="number"
                                name="unidCaja"
                                value={productData.unidCaja}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900 bg-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-900">Stock Total</label>
                            <input
                                type="number"
                                name="stockTotal"
                                value={productData.stockTotal}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900 bg-slate-100"
                            />
                        </div>
                    </div>
                </div>
    
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Consumo Mensual 2024</h3>
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {productData.consumos.map((consumo, index) => (
                            <div key={index}>
                                <label className="block text-xs font-medium text-slate-800 mb-1">{months[index]}</label>
                                <input
                                    type="number"
                                    value={consumo}
                                    onChange={(e) => handleChange(e, index)}
                                    className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 text-slate-900 bg-slate-100"
                                />
                            </div>
                        ))}
                    </div>
                </div>
    
                <div className="flex justify-end gap-3 pt-6">
                    <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
                        Cancelar
                    </button>
                    <button type="submit" className="px-6 py-2 rounded-lg bg-sky-500 text-white hover:bg-sky-600 focus:ring-2 focus:ring-sky-200">
                        Guardar Producto
                    </button>
                </div>
            </form>
        </div>
    );    
};

export default ProductForm;
