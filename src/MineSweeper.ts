class Startup {
    public static main(): any {
        var MineSweeper : Game = new Game(15, 10 , 30);

        $(document).ready(function ():void {
            $("#board").on("mousedown", ".field", function(e : any): void {
                $("#board").addClass("pushed");
                if(e.which === 1 && !MineSweeper.has_game_finished()) {
                    document.getElementById("smiley").innerHTML = "😱";
                }
            });

            $("#board").on("mouseup", ".field", function (e : any): void {
                $("#board").removeClass("pushed");
                if(MineSweeper.has_game_finished()) {
                    return;
                }
                var x : number = $(this).data("x");
                var y : number = $(this).data("y");
                switch (e.which) {
                    // left Click.
                    case 1:
                        document.getElementById("smiley").innerHTML = "😀";
                        MineSweeper.step_on_field(x, y);
                    break;
                    // middle click.
                    case 2:
                        MineSweeper.mark_field(x, y);
                    break;
                }
                var remaining_mines : number = MineSweeper.remaining_mines();
                document.getElementById("remaining-mines").innerHTML = Helper.three_digets(remaining_mines);
                return;
            });

            $("#start-game").click(function(): void {
                var width : number = +$("#width").val() > 99 ? 99 : +$("#width").val();
                var height : number = +$("#height").val() > 99 ? 99 : +$("#height").val();
                var mines : number = +$("#mines").val() > width * height
                    ? Math.floor(Math.random() * (width*height - 1))
                    : +$("#mines").val();

                if(mines > 0 && width > 0 && height > 0) {
                    MineSweeper.stop_game();
                    MineSweeper = new Game(width, height, mines);
                }
            });

            $("#smiley").click(function(): void {
                $("#start-game").click();
            });
        });
    }
}

class Game {
    private Board : Board;
    private Countdown : Countdown;
    private game_ended : boolean;

    constructor(sizeY : number, sizeX : number, mines : number) {
        this.Board = new Board(sizeX, sizeY, mines);
        var boardWidth : string = sizeY * 20 + "px";
        this.Countdown = new Countdown();
        this.Countdown.countdown();
        document.getElementById("board").style.width = boardWidth;
        document.getElementById("remaining-mines").innerHTML = Helper.three_digets(mines);
        document.getElementById("smiley").innerHTML = "😀";
    }

    public step_on_field(x: number, y: number): void {
        try {
            this.Board.step_on_field(x, y);
            if(this.check_victory()) {
                this.stop_game();
                document.getElementById("smiley").innerHTML = "😎";
            }
        } catch(err) {
            this.Board.cheat();
            this.Board.fields[x][y].view = FieldView.Exploding;
            this.Board.printBoard();
            this.stop_game();
            document.getElementById("smiley").innerHTML = "😵";
        }
    }

    public lock_game(): void {
        this.game_ended = true;
    }

    public has_game_finished(): boolean {
        return this.game_ended;
    }

    public mark_field(x: number, y: number): void {
        this.Board.markField(x, y);
    }

    public remaining_mines(): number {
        return this.Board.remaining_mines();
    }

    public stop_game(): void {
        this.lock_game();
        this.Countdown.stop();
    }

    private check_victory(): boolean {
        var visited_fields : number = 0;
        var everything_visited : boolean = false;
        var number_of_fields : number = this.Board.sizeY * this.Board.sizeX;

        for(var i : number = 0; i < this.Board.sizeX; i++) {
            for(var j : number = 0; j < this.Board.sizeY; j++) {
                if(this.Board.fields[i][j].visited) {
                    visited_fields++;
                }
            }
        }

        if(number_of_fields - visited_fields === this.Board.number_of_bombs) {
            everything_visited = true;
        }

        return everything_visited;
    }
}

class Countdown {
    public countdown(): void {
        var seconds : number = -1;
        var element : any;

        function updateTimer(): void {
            seconds++;
            if ( seconds < 999 ) {
                setTimeout( updateTimer, 1000);
            }
            element.innerHTML = (Helper.three_digets(seconds));
        }

        element = document.getElementById( "time" );
        updateTimer();
    }

    public stop(): void {
        var highestTimeoutId : number = setTimeout(";");
        for (var i : number = 0 ; i < highestTimeoutId ; i++) {
            clearTimeout(i);
        }
    }
}

class Board {
    public sizeX : number;
    public sizeY: number;
    public number_of_bombs : number;
    public fields : Field[][];

    constructor(sizeX : number, sizeY : number, number_of_bombs : number) {
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.number_of_bombs = number_of_bombs;
        this.createFields();
        this.seedMines();
        this.printBoard();
    }

    public remaining_mines(): number {
        var flags : number = 0;

        for(var i : number = 0; i < this.sizeX; i++) {
            for(var j : number = 0; j < this.sizeY; j++) {
                if(this.fields[i][j].view === FieldView.Flagged) {
                    flags++;
                }
            }
        }

        return ((this.number_of_bombs - flags > 0) ? this.number_of_bombs - flags : 0);
    }

    public cheat(): void {
        for(var i : number = 0; i < this.sizeX; i++) {
            for(var j : number = 0; j < this.sizeY; j++) {
                if(this.fields[i][j].type === FieldType.Mine) {
                    this.fields[i][j].view = FieldView.Mine;
                } else {
                    this.fields[i][j].view = this.calculate_field_view(i, j);
                }
            }
        }
        this.printBoard();
    }

    public markField(x : number, y : number): void {
        this.fields[x][y].set_next_marker();
        this.printBoard();
    }

    public step_on_field(x: number, y : number): void {
        if(this.fields[x][y].view === FieldView.Flagged) {
            return;
        }

        if(this.fields[x][y].type === FieldType.Mine) {
            this.fields[x][y].view = FieldView.Exploding;
            throw 1;
        } else {
            this.calculate_field_view(x, y);
        }
        this.printBoard();
    }

    private calculate_field_view(x : number, y : number): FieldView {
        var neighbor_mines : number = 0;
        var field_view : FieldView;
        neighbor_mines = this.findingNeighbors(x, y);

        switch(neighbor_mines) {
            case 1:
                field_view =  FieldView.One;
            break;
            case 2:
                field_view =  FieldView.Two;
            break;
            case 3:
                field_view =  FieldView.Three;
            break;
            case 4:
                field_view =  FieldView.Four;
            break;
            case 5:
                field_view =  FieldView.Five;
            break;
            case 6:
                field_view =  FieldView.Six;
            break;
            case 7:
                field_view =  FieldView.Seven;
            break;
            case 8:
                field_view =  FieldView.Eight;
            break;
            default:
                field_view =  FieldView.Zero;
            break;
        }

        this.fields[x][y].view = field_view;
        this.fields[x][y].visited = true;

        if(neighbor_mines === 0) {
            this.step_on_neighbours(x, y);
        }

        return field_view;
    }

    private findingNeighbors(i : number, j : number): number {
        var rowLimit : number = this.sizeX-1;
        var columnLimit : number = this.sizeY-1;
        var neighbor_mines : number = 0;

        for(var x : number = Math.max(0, i-1); x <= Math.min(i+1, rowLimit); x++) {
          for(var y : number = Math.max(0, j-1); y <= Math.min(j+1, columnLimit); y++) {
            if(x !== i || y !== j) {
              if(this.fields[x][y].type === FieldType.Mine) {
                  neighbor_mines++;
              }
            }
          }
        }
        return neighbor_mines;
    }

    private step_on_neighbours(i : number, j : number): void {
        var rowLimit : number = this.sizeX-1;
        var columnLimit : number = this.sizeY-1;

        for(var x : number = Math.max(0, i-1); x <= Math.min(i+1, rowLimit); x++) {
          for(var y : number = Math.max(0, j-1); y <= Math.min(j+1, columnLimit); y++) {
            if(x !== i || y !== j) {
                if(this.fields[x][y].view === FieldView.Unknown) {
                    this.calculate_field_view(x, y);
                }
            }
          }
        }
    }

    private createFields(): void {
        this.fields = [];
        for(var i : number = 0; i < this.sizeX; i++) {
            this.fields[i] = [];
            for(var j : number = 0; j < this.sizeY; j++) {
                this.fields[i][j] = new Field();
            }
        }
    }

    private seedMines(): void {
        var bombsPlaced : number = 0;
        while(bombsPlaced < this.number_of_bombs) {
            var randX : number = Math.floor((Math.random() * this.sizeX));
            var randY : number = Math.floor((Math.random() * this.sizeY));
            if(this.fields[randX][randY].type === FieldType.Empty) {
                this.fields[randX][randY].type = FieldType.Mine;
                bombsPlaced++;
            }
        }
    }

    public printBoard(): void {
        var html : string = this.to_html();
        document.getElementById("board").innerHTML = html;
    }

    private to_html(): string {
        var html : string = "";
        for(var i : number = 0; i < this.sizeX; i++) {
            html += "<div class='line'>";
            for(var j : number = 0; j < this.sizeY; j++) {
                html += this.fields[i][j].to_html(i, j);
            }
            html += "</div>";
        }
        return html;
    }
}

class Field {
    public type : FieldType;
    public view : FieldView;
    public visited : boolean;

    constructor() {
        this.view = FieldView.Unknown;
        this.type = FieldType.Empty;
        this.visited = false;
    }

    public set_next_marker(): void {
        switch(this.view) {
            case FieldView.Unknown:
                this.view = FieldView.Flagged;
            break;
            case FieldView.Flagged:
                this.view = FieldView.Unknown;
            break;
        }
    }

    public to_html(x : number, y : number): string {
        var html : string = "<div class='field " + FieldView[this.view] + "' data-x='" + x + "' data-y='" + y + "'></div>";
        return html;
    }
}

class Helper {
    public static three_digets( n : number ): string {
        if(n <= 9) {
            return "00" + n;
        } else if (n <= 99) {
            return "0" + n;
        } else {
            return n.toString();
        }
    }
}

enum FieldType {
    Mine,
    Empty
}

enum FieldView {
    Unknown,
    Flagged,
    Exploding,
    Zero,
    One,
    Two,
    Three,
    Four,
    Five,
    Six,
    Seven,
    Eight,
    Mine
}

Startup.main();