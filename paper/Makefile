.PHONY: paper clean

paper:
	@if command -v latexmk >/dev/null 2>&1; then \
		latexmk -pdf -interaction=nonstopmode worldmodelgym.tex; \
	elif command -v pdflatex >/dev/null 2>&1 && command -v bibtex >/dev/null 2>&1; then \
		pdflatex -interaction=nonstopmode worldmodelgym.tex; \
		bibtex worldmodelgym; \
		pdflatex -interaction=nonstopmode worldmodelgym.tex; \
		pdflatex -interaction=nonstopmode worldmodelgym.tex; \
	elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		docker run --rm -v "$$(pwd):/work" -w /work blang/latex:ctanfull \
			latexmk -pdf -interaction=nonstopmode worldmodelgym.tex; \
	else \
		python3 build_paper_fallback.py worldmodelgym.tex worldmodelgym.pdf; \
	fi

clean:
	@if command -v latexmk >/dev/null 2>&1; then \
		latexmk -C; \
	else \
		rm -f *.aux *.bbl *.blg *.fdb_latexmk *.fls *.log *.out *.toc worldmodelgym.pdf; \
	fi
